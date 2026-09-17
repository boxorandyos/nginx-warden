import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../../../utils/logger';
import { getWebrootPath, setupWebrootDirectory } from '../../../utils/nginx-setup';
import { AcmeOptions, CertificateFiles, ParsedCertificate, SSL_CONSTANTS } from '../ssl.types';
import {
  AcmeProviderId,
  acmeServerFlag,
  normalizeAcmeProvider,
} from '../ssl-issuer.util';

const execFileAsync = promisify(execFile);

const ACME_TIMEOUT_MS = SSL_CONSTANTS.ACME_TIMEOUT_MS;

/**
 * ACME Service - Handles Let's Encrypt / ZeroSSL certificate operations via acme.sh
 */
export class AcmeService {
  private defaultCA: AcmeProviderId =
    normalizeAcmeProvider(process.env.ACME_CA_SERVER) || 'letsencrypt';

  getDefaultCA(): AcmeProviderId {
    return this.defaultCA;
  }

  /**
   * Resolve acme.sh binary. `which acme.sh` often fails because acme.sh lives in ~/.acme.sh.
   */
  resolveAcmeBinary(): string | null {
    const candidates = [
      process.env.ACME_SH_PATH,
      path.join(process.env.HOME || '/root', '.acme.sh', 'acme.sh'),
      '/root/.acme.sh/acme.sh',
      '/usr/local/bin/acme.sh',
      '/usr/bin/acme.sh',
    ].filter((p): p is string => Boolean(p));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  async isAcmeInstalled(): Promise<boolean> {
    return this.resolveAcmeBinary() !== null;
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  private sanitizeInput(input: string): string {
    return input.replace(/[;&|`$(){}[\]<>'"\\]/g, '');
  }

  private async runAcme(
    acmeScript: string,
    args: string[],
    timeoutMs: number = ACME_TIMEOUT_MS
  ): Promise<{ stdout: string; stderr: string }> {
    logger.info(`[acme.sh] ${acmeScript} ${args.join(' ')}`);
    try {
      const { stdout, stderr } = await execFileAsync(acmeScript, args, {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PATH: `${path.dirname(acmeScript)}:${process.env.PATH}` },
      });
      return { stdout: stdout || '', stderr: stderr || '' };
    } catch (error: any) {
      const stdout = error.stdout || '';
      const stderr = error.stderr || '';
      const combined = `${stdout}\n${stderr}\n${error.message || ''}`;
      const wrapped = new Error(combined);
      (wrapped as any).stdout = stdout;
      (wrapped as any).stderr = stderr;
      throw wrapped;
    }
  }

  async installAcme(email?: string): Promise<void> {
    try {
      logger.info('Installing acme.sh...');

      if (email) {
        if (!this.validateEmail(email)) {
          throw new Error('Invalid email format');
        }
        email = this.sanitizeInput(email);
      }

      const installArgs = email ? ['https://get.acme.sh', '-s', `email=${email}`] : ['https://get.acme.sh'];
      await execFileAsync('curl', installArgs, {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      }).catch(async () => {
        // Official installer pipes to sh; curl | sh is required by acme.sh
        const cmd = email
          ? `curl https://get.acme.sh | sh -s email=${email}`
          : `curl https://get.acme.sh | sh`;
        await execFileAsync('bash', ['-c', cmd], {
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });
      });

      const homeDir = process.env.HOME || '/root';
      const acmePath = path.join(homeDir, '.acme.sh');
      process.env.PATH = `${acmePath}:${process.env.PATH}`;

      logger.info('acme.sh installed successfully');
    } catch (error) {
      logger.error('Failed to install acme.sh:', error);
      throw new Error('Failed to install acme.sh');
    }
  }

  private async ensureAcme(email?: string): Promise<string> {
    let binary = this.resolveAcmeBinary();
    if (!binary) {
      await this.installAcme(email);
      binary = this.resolveAcmeBinary();
    }
    if (!binary) {
      throw new Error('acme.sh is not installed');
    }
    return binary;
  }

  /**
   * Register a ZeroSSL ACME account with EAB credentials when provided.
   */
  async registerZeroSslAccount(
    acmeScript: string,
    email?: string,
    eabKid?: string,
    eabHmacKey?: string
  ): Promise<void> {
    const args = ['--register-account', '--server', 'zerossl'];
    if (email) {
      args.push('--accountemail', email);
    }
    if (eabKid && eabHmacKey) {
      args.push('--eab-kid', eabKid, '--eab-hmac-key', eabHmacKey);
    }
    try {
      const { stdout, stderr } = await this.runAcme(acmeScript, args, 60000);
      logger.info(`ZeroSSL account register: ${stdout} ${stderr}`);
    } catch (error: any) {
      const msg = error.message || '';
      // Already registered is fine
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        logger.info('ZeroSSL ACME account already registered');
        return;
      }
      logger.warn(`ZeroSSL account registration warning: ${msg}`);
      if (!eabKid || !eabHmacKey) {
        throw new Error(
          'ZeroSSL requires External Account Binding (EAB) credentials. Add the EAB Key ID and HMAC key under Configuration, or use Let\'s Encrypt instead.'
        );
      }
      throw new Error(`Failed to register ZeroSSL ACME account: ${msg}`);
    }
  }

  async issueCertificate(options: AcmeOptions): Promise<CertificateFiles> {
    try {
      const { domain, sans, email, dns } = options;
      const provider: AcmeProviderId = options.provider || this.defaultCA;
      const caServer = acmeServerFlag(provider);

      const acmeScript = await this.ensureAcme(email);

      logger.info(`Issuing certificate for ${domain} using ${caServer}`);

      const webroot = options.webroot || getWebrootPath();
      await setupWebrootDirectory();

      if (provider === 'zerossl') {
        await this.registerZeroSslAccount(
          acmeScript,
          email,
          options.eabKid,
          options.eabHmacKey
        );
      }

      const args = ['--issue', '--server', caServer, '-d', domain];

      if (sans && sans.length > 0) {
        for (const san of sans) {
          if (san !== domain) {
            args.push('-d', san);
          }
        }
      }

      if (dns) {
        args.push('--dns', dns);
      } else {
        args.push('-w', webroot);
      }

      if (email) {
        args.push('--accountemail', email);
      }

      if (options.force !== false) {
        args.push('--force');
      }

      const { stdout, stderr } = await this.runAcme(acmeScript, args);
      logger.info(`acme.sh output: ${stdout}`);
      if (stderr) {
        logger.warn(`acme.sh stderr: ${stderr}`);
      }

      return this.readAndInstallCertFiles(domain);
    } catch (error: any) {
      logger.error('Failed to issue certificate:', error);
      throw new Error(`Failed to issue certificate: ${error.message}`);
    }
  }

  /**
   * Renew (or force-renew) a certificate with the same CA used to issue it.
   */
  async renewCertificate(
    domain: string,
    options: {
      provider?: AcmeProviderId;
      force?: boolean;
      eabKid?: string;
      eabHmacKey?: string;
      email?: string;
    } = {}
  ): Promise<CertificateFiles> {
    try {
      logger.info(`Renewing certificate for ${domain}`);

      const acmeScript = await this.ensureAcme(options.email);
      const homeDir = process.env.HOME || '/root';
      const eccDir = path.join(homeDir, '.acme.sh', `${domain}_ecc`);
      const isECC = fs.existsSync(eccDir);
      const provider = options.provider || this.defaultCA;

      if (provider === 'zerossl' && options.eabKid && options.eabHmacKey) {
        await this.registerZeroSslAccount(
          acmeScript,
          options.email,
          options.eabKid,
          options.eabHmacKey
        );
      }

      const args = ['--renew', '-d', domain, '--server', acmeServerFlag(provider)];
      if (isECC) {
        args.push('--ecc');
      }
      if (options.force) {
        args.push('--force');
      }

      const { stdout, stderr } = await this.runAcme(acmeScript, args);
      logger.info(`acme.sh renew output: ${stdout}`);
      if (stderr) {
        logger.warn(`acme.sh renew stderr: ${stderr}`);
      }

      return this.readAndInstallCertFiles(domain);
    } catch (error: any) {
      const errorMsg = error.message || error.toString();
      if (errorMsg.includes('retryafter') || errorMsg.includes('too large')) {
        logger.warn(`Certificate renewal rate limited for ${domain}, will retry later`);
        throw new Error(`Rate limited by CA, will retry in next cycle`);
      }

      if (
        !options.force &&
        (errorMsg.includes('not due for renewal') || errorMsg.includes('Skip'))
      ) {
        logger.info(`Certificate for ${domain} is not yet due for renewal`);
        throw new Error(`Certificate not yet due for renewal`);
      }

      logger.error('Failed to renew certificate:', error);
      throw new Error(`Failed to renew certificate: ${error.message}`);
    }
  }

  private async readAndInstallCertFiles(domain: string): Promise<CertificateFiles> {
    const homeDir = process.env.HOME || '/root';
    const baseDir = path.join(homeDir, '.acme.sh');
    const eccDir = path.join(baseDir, `${domain}_ecc`);
    const certDir = fs.existsSync(eccDir) ? eccDir : path.join(baseDir, domain);

    const certificateFile = path.join(certDir, `${domain}.cer`);
    const keyFile = path.join(certDir, `${domain}.key`);
    const caFile = path.join(certDir, 'ca.cer');
    const fullchainFile = path.join(certDir, 'fullchain.cer');

    const certificate = await fs.promises.readFile(certificateFile, 'utf8');
    const privateKey = await fs.promises.readFile(keyFile, 'utf8');
    const chain = await fs.promises.readFile(caFile, 'utf8');
    const fullchain = await fs.promises.readFile(fullchainFile, 'utf8');

    const nginxSslDir = '/etc/nginx/ssl';
    if (!fs.existsSync(nginxSslDir)) {
      await fs.promises.mkdir(nginxSslDir, { recursive: true });
    }

    await fs.promises.writeFile(path.join(nginxSslDir, `${domain}.crt`), fullchain);
    await fs.promises.writeFile(path.join(nginxSslDir, `${domain}.key`), privateKey);
    await fs.promises.writeFile(path.join(nginxSslDir, `${domain}.chain.crt`), chain);

    logger.info(`Certificate installed to ${nginxSslDir} for ${domain}`);

    return { certificate, privateKey, chain, fullchain };
  }

  async validateKeyPair(certificate: string, privateKey: string): Promise<boolean> {
    try {
      const forge = await import('node-forge');

      const cert = forge.pki.certificateFromPem(certificate);
      let privKey;

      try {
        privKey = forge.pki.privateKeyFromPem(privateKey);
      } catch (error) {
        try {
          privKey = forge.pki.privateKeyFromPem(privateKey);
        } catch {
          throw new Error('Invalid private key format');
        }
      }

      const certPublicKey = cert.publicKey as any;

      if (certPublicKey.n && (privKey as any).n) {
        const certModulus = (certPublicKey.n as any).toString(16);
        const keyModulus = ((privKey as any).n as any).toString(16);
        return certModulus === keyModulus;
      }

      return true;
    } catch (error) {
      logger.warn('Key pair validation failed, will rely on nginx validation:', error);
      return true;
    }
  }

  async parseCertificate(certContent: string): Promise<ParsedCertificate> {
    try {
      try {
        const forge = await import('node-forge');
        const cert = forge.pki.certificateFromPem(certContent);

        const getAttrValue = (attrs: any[], attrName: string): string | undefined => {
          const value = attrs.find((attr: any) => attr.name === attrName)?.value;
          return Array.isArray(value) ? value[0] : value;
        };

        const subjectAttrs = cert.subject.attributes;
        const subjectCN = getAttrValue(subjectAttrs, 'commonName') || '';
        const subjectO = getAttrValue(subjectAttrs, 'organizationName');
        const subjectC = getAttrValue(subjectAttrs, 'countryName');

        const issuerAttrs = cert.issuer.attributes;
        const issuerCN = getAttrValue(issuerAttrs, 'commonName') || '';
        const issuerO = getAttrValue(issuerAttrs, 'organizationName');
        const issuerC = getAttrValue(issuerAttrs, 'countryName');

        const subject = cert.subject.attributes
          .map((attr: any) => `${attr.shortName}=${attr.value}`)
          .join(', ');

        const issuer = cert.issuer.attributes
          .map((attr: any) => `${attr.shortName}=${attr.value}`)
          .join(', ');

        const sans: string[] = [];
        const sanExtension = cert.extensions.find((ext: any) => ext.name === 'subjectAltName');

        if (sanExtension && sanExtension.altNames) {
          sanExtension.altNames.forEach((altName: any) => {
            if (altName.type === 2) {
              sans.push(altName.value);
            }
          });
        }

        if (sans.length === 0 && subjectCN) {
          sans.push(subjectCN);
        }

        const serialNumber = cert.serialNumber;
        const validFrom = new Date(cert.validity.notBefore);
        const validTo = new Date(cert.validity.notAfter);

        logger.info(
          `Certificate parsed: CN=${subjectCN}, Issuer=${issuerCN}, Valid: ${validFrom.toISOString()} - ${validTo.toISOString()}`
        );

        return {
          commonName: subjectCN,
          sans,
          issuer: issuerO || issuerCN,
          issuerDetails: {
            commonName: issuerCN,
            organization: issuerO,
            country: issuerC,
          },
          subject: subjectCN,
          subjectDetails: {
            commonName: subjectCN,
            organization: subjectO,
            country: subjectC,
          },
          validFrom,
          validTo,
          serialNumber,
        };
      } catch (forgeError: any) {
        logger.info('node-forge failed, trying native X509Certificate (EC support)');

        const { X509Certificate } = await import('crypto');
        const cert = new X509Certificate(certContent);

        const commonName =
          cert.subject.split('\n').find((line) => line.startsWith('CN='))?.replace('CN=', '') || '';
        const issuerCN =
          cert.issuer.split('\n').find((line) => line.startsWith('CN='))?.replace('CN=', '') || '';
        const issuerO = cert.issuer.split('\n').find((line) => line.startsWith('O='))?.replace('O=', '');
        const issuerC = cert.issuer.split('\n').find((line) => line.startsWith('C='))?.replace('C=', '');

        const subjectO = cert.subject.split('\n').find((line) => line.startsWith('O='))?.replace('O=', '');
        const subjectC = cert.subject.split('\n').find((line) => line.startsWith('C='))?.replace('C=', '');

        const sans: string[] = [];
        const sanMatch = cert.subjectAltName?.match(/DNS:([^,]+)/g);
        if (sanMatch) {
          sanMatch.forEach((san) => {
            const domain = san.replace('DNS:', '');
            if (domain) sans.push(domain);
          });
        }

        if (sans.length === 0 && commonName) {
          sans.push(commonName);
        }

        const validFrom = new Date(cert.validFrom);
        const validTo = new Date(cert.validTo);

        logger.info(
          `Certificate parsed (EC): CN=${commonName}, Valid: ${validFrom.toISOString()} - ${validTo.toISOString()}`
        );

        return {
          commonName,
          sans,
          issuer: issuerO || issuerCN || 'Unknown',
          issuerDetails: {
            commonName: issuerCN,
            organization: issuerO,
            country: issuerC,
          },
          subject: commonName,
          subjectDetails: {
            commonName,
            organization: subjectO,
            country: subjectC,
          },
          validFrom,
          validTo,
          serialNumber: cert.serialNumber,
        };
      }
    } catch (error) {
      logger.error('Failed to parse certificate:', error);
      throw new Error('Failed to parse certificate');
    }
  }
}

export const acmeService = new AcmeService();
