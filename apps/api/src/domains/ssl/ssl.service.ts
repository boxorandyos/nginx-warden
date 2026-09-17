import * as fs from 'fs/promises';
import * as path from 'path';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { sslRepository } from './ssl.repository';
import { acmeService } from './services/acme.service';
import {
  SSLCertificateWithDomain,
  SSLCertificateWithStatus,
  SSL_CONSTANTS,
  SSLStatus,
} from './ssl.types';
import {
  IssueAutoSSLDto,
  UploadManualSSLDto,
  UpdateSSLDto,
} from './dto';
import {
  AcmeProviderId,
  inferProviderFromIssuer,
  isAcmeRenewable,
  normalizeAcmeProvider,
  toPrismaAcmeProvider,
} from './ssl-issuer.util';
import { nginxReloadService } from '../domains/services/nginx-reload.service';
import { nginxConfigService } from '../domains/services/nginx-config.service';
import { domainsRepository } from '../domains/domains.repository';

/**
 * SSL Service - Handles all SSL certificate business logic
 */
export class SSLService {
  /**
   * Validate email format to prevent injection attacks
   */
  private validateEmail(email: string): boolean {
    // RFC 5322 compliant email regex (simplified but secure)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Additional checks
    if (email.length > 254) return false; // Max email length per RFC
    if (email.includes('..')) return false; // No consecutive dots
    if (email.startsWith('.') || email.endsWith('.')) return false; // No leading/trailing dots

    const parts = email.split('@');
    if (parts.length !== 2) return false;

    const [localPart, domain] = parts;
    if (localPart.length > 64) return false; // Max local part length
    if (domain.length > 253) return false; // Max domain length

    return emailRegex.test(email);
  }

  /**
   * Sanitize email input to prevent command injection
   */
  private sanitizeEmail(email: string): string {
    // Remove any characters that could be used for command injection
    // Keep only characters valid in email addresses
    return email.replace(/[;&|`$(){}[\]<>'"\\!*#?~\s]/g, '');
  }

  /**
   * Validate and sanitize email with comprehensive security checks
   */
  private secureEmail(email: string | undefined): string | undefined {
    if (!email) return undefined;

    // Trim whitespace
    email = email.trim();

    // Check length before validation
    if (email.length === 0 || email.length > 254) {
      throw new Error('Invalid email format: length must be between 1 and 254 characters');
    }

    // Validate format
    if (!this.validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Sanitize as additional security layer (defense in depth)
    const sanitized = this.sanitizeEmail(email);

    // Verify sanitization didn't break the email
    if (!this.validateEmail(sanitized)) {
      throw new Error('Email contains invalid characters');
    }

    return sanitized;
  }

  /**
   * Calculate SSL status based on expiry date
   */
  private calculateStatus(validTo: Date): SSLStatus {
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      return 'expired';
    } else if (daysUntilExpiry < SSL_CONSTANTS.EXPIRING_THRESHOLD_DAYS) {
      return 'expiring';
    }
    return 'valid';
  }

  /**
   * Get all SSL certificates with computed status.
   * Uses stored validity dates so listing stays fast (no PEM re-parse on every request).
   */
  async getAllCertificates(): Promise<SSLCertificateWithStatus[]> {
    const certificates = await sslRepository.findAll();
    const now = new Date();

    return certificates.map((cert) => {
      const daysUntilExpiry = Math.floor(
        (cert.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...cert,
        status: this.calculateStatus(cert.validTo),
        daysUntilExpiry,
        acmeRenewable: isAcmeRenewable(cert.issuer, (cert as any).acmeProvider),
      };
    });
  }

  /**
   * Get single SSL certificate by ID
   */
  async getCertificateById(id: string): Promise<SSLCertificateWithDomain | null> {
    return sslRepository.findById(id);
  }

  /**
   * Issue automatic SSL certificate using Let's Encrypt/ZeroSSL
   */
  async issueAutoCertificate(
    dto: IssueAutoSSLDto,
    userId: string,
    ip: string,
    userAgent: string
  ): Promise<SSLCertificateWithDomain> {
    const { domainId, email, autoRenew = true } = dto;

    // Validate and sanitize email input
    const secureEmailAddress = this.secureEmail(email);

    // Check if domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    // Check if certificate already exists
    const existingCert = await sslRepository.findByDomainId(domainId);
    if (existingCert) {
      throw new Error('SSL certificate already exists for this domain');
    }

    const systemConfig = await prisma.systemConfig.findFirst();
    const provider =
      normalizeAcmeProvider(dto.acmeProvider) ||
      normalizeAcmeProvider(systemConfig?.acmeDefaultProvider) ||
      acmeService.getDefaultCA();

    logger.info(`Issuing SSL certificate for ${domain.name} using ${provider}`);

    try {
      const certFiles = await acmeService.issueCertificate({
        domain: domain.name,
        email: secureEmailAddress,
        webroot: '/var/www/html',
        standalone: false,
        provider,
        eabKid: systemConfig?.zerosslEabKid || undefined,
        eabHmacKey: systemConfig?.zerosslEabHmacKey || undefined,
      });

      // Parse certificate to get details
      const certInfo = await acmeService.parseCertificate(certFiles.certificate);

      logger.info(`SSL certificate issued successfully for ${domain.name}`);

      // Create SSL certificate in database
      const createData: any = {
        domain: {
          connect: { id: domainId },
        },
        commonName: certInfo.commonName,
        sans: certInfo.sans,
        issuer: certInfo.issuer,
        certificate: certFiles.certificate,
        privateKey: certFiles.privateKey,
        chain: certFiles.chain,
        validFrom: certInfo.validFrom,
        validTo: certInfo.validTo,
        autoRenew,
        status: 'valid',
        acmeProvider: toPrismaAcmeProvider(provider),
      };
      
      // Add optional fields if they exist
      if (certInfo.subject) createData.subject = certInfo.subject;
      if (certInfo.subjectDetails) createData.subjectDetails = certInfo.subjectDetails;
      if (certInfo.issuerDetails) createData.issuerDetails = certInfo.issuerDetails;
      if (certInfo.serialNumber) createData.serialNumber = certInfo.serialNumber;
      
      const sslCertificate = await sslRepository.create(createData);

      // Update domain SSL expiry (DO NOT auto-enable SSL)
      await sslRepository.updateDomainSSLExpiry(domainId, sslCertificate.validTo);

      // Log activity
      await this.logActivity(
        userId,
        `Issued SSL certificate for ${domain.name}`,
        ip,
        userAgent,
        true
      );

      logger.info(`SSL certificate issued for ${domain.name} by user ${userId}`);

      return sslCertificate;
    } catch (error: any) {
      logger.error(`Failed to issue SSL certificate for ${domain.name}:`, error);

      // Log failed activity
      await this.logActivity(
        userId,
        `Failed to issue SSL certificate for ${domain.name}: ${error.message}`,
        ip,
        userAgent,
        false
      );

      throw new Error(`Failed to issue SSL certificate: ${error.message}`);
    }
  }

  /**
   * Upload manual SSL certificate
   */
  async uploadManualCertificate(
    dto: UploadManualSSLDto,
    userId: string,
    ip: string,
    userAgent: string
  ): Promise<SSLCertificateWithDomain> {
    const { domainId, certificate, privateKey, chain, issuer } = dto;

    // Check if domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    // Check if certificate already exists
    const existingCert = await sslRepository.findByDomainId(domainId);
    if (existingCert) {
      throw new Error('SSL certificate already exists for this domain. Use update endpoint instead.');
    }

    // Validate certificate and private key formats
    let certInfo;
    try {
      certInfo = await acmeService.parseCertificate(certificate);
      logger.info(`Parsed manual certificate: CN=${certInfo.commonName}, Issuer=${certInfo.issuer}, Valid: ${certInfo.validFrom.toISOString()} - ${certInfo.validTo.toISOString()}`);
    } catch (error: any) {
      logger.error('Failed to parse manual certificate:', error);
      throw new Error(`Invalid certificate format: ${error.message}`);
    }

    // Validate private key matches certificate
    try {
      const isValidKeyPair = await acmeService.validateKeyPair(certificate, privateKey);
      if (!isValidKeyPair) {
        throw new Error('Private key does not match the certificate. Please ensure you upload the correct key pair.');
      }
    } catch (error: any) {
      if (error.message.includes('does not match')) {
        throw error;
      }
      logger.warn('Key pair validation could not be completed, proceeding with caution:', error.message);
      // Continue - nginx will validate when loading
    }

    // Validate domain name matches certificate (CN or SANs)
    // Support wildcard certificates for subdomains
    // Example: *.nginxwaf.me can be used for dev.nginxwaf.me, api.nginxwaf.me, etc.
    const matchesHostname = (certName: string, domainName: string): boolean => {
      const cert = certName.toLowerCase();
      const domain = domainName.toLowerCase();

      // Exact match
      if (cert === domain) return true;

      // Wildcard match: *.example.com matches sub.example.com
      if (cert.startsWith('*.')) {
        const baseDomain = cert.slice(2); // Remove '*.'
        
        // Check if domain ends with the base domain
        // sub.example.com should match *.example.com
        if (domain.endsWith(baseDomain)) {
          // Ensure it's a proper subdomain match (not partial match)
          // e.g., *.example.com matches sub.example.com but not badexample.com
          const beforeBase = domain.slice(0, domain.length - baseDomain.length);
          return beforeBase === '' || beforeBase.endsWith('.');
        }
      }

      // Check if domain is subdomain and cert is wildcard for parent
      // Example: domain = dev.nginxwaf.me, cert = *.nginxwaf.me should match
      const domainParts = domain.split('.');
      if (domainParts.length >= 3) {
        // Get parent domain (e.g., dev.nginxwaf.me -> nginxwaf.me)
        const parentDomain = domainParts.slice(1).join('.');
        const wildcardParent = `*.${parentDomain}`;
        
        if (cert === wildcardParent) {
          return true;
        }
      }

      return false;
    };

    // Check if certificate matches the domain
    const domainMatches = 
      matchesHostname(certInfo.commonName, domain.name) ||
      certInfo.sans.some(san => matchesHostname(san, domain.name));

    if (!domainMatches) {
      logger.warn(`Certificate domain mismatch: Certificate CN="${certInfo.commonName}", SANs=[${certInfo.sans.join(', ')}] does not match domain "${domain.name}"`);
      throw new Error(
        `Certificate domain mismatch: This certificate is for "${certInfo.commonName}" (SANs: ${certInfo.sans.join(', ')}) but you selected domain "${domain.name}". Please upload the correct certificate or ensure the certificate includes a wildcard that covers this domain.`
      );
    }

    logger.info(`Certificate validated successfully for ${domain.name}. Matched against CN="${certInfo.commonName}" or SANs=[${certInfo.sans.join(', ')}]`);

    // Validate certificate is not expired
    const now = new Date();
    if (certInfo.validTo < now) {
      throw new Error(`Certificate has already expired on ${certInfo.validTo.toISOString()}. Please upload a valid certificate.`);
    }

    // Warn if certificate is expiring soon
    const daysUntilExpiry = Math.floor(
      (certInfo.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry < 30) {
      logger.warn(`Uploaded certificate for ${domain.name} expires in ${daysUntilExpiry} days`);
    }

    // Use parsed information
    const finalIssuer = issuer || certInfo.issuer || SSL_CONSTANTS.MANUAL_ISSUER;
    const status = this.calculateStatus(certInfo.validTo);

    // Create certificate with real information
    const createData: any = {
      domain: {
        connect: { id: domainId },
      },
      commonName: certInfo.commonName,
      sans: certInfo.sans,
      issuer: finalIssuer,
      certificate,
      privateKey,
      chain: chain || null,
      validFrom: certInfo.validFrom,
      validTo: certInfo.validTo,
      autoRenew: false, // Manual certs don't auto-renew
      status,
    };
    
    // Add optional fields if they exist
    if (certInfo.subject) createData.subject = certInfo.subject;
    if (certInfo.subjectDetails) createData.subjectDetails = certInfo.subjectDetails;
    if (certInfo.issuerDetails) createData.issuerDetails = certInfo.issuerDetails;
    if (certInfo.serialNumber) createData.serialNumber = certInfo.serialNumber;
    
    const cert = await sslRepository.create(createData);

    // Write certificate files to disk
    try {
      await fs.mkdir(SSL_CONSTANTS.CERTS_PATH, { recursive: true });
      await fs.writeFile(path.join(SSL_CONSTANTS.CERTS_PATH, `${domain.name}.crt`), certificate);
      await fs.writeFile(path.join(SSL_CONSTANTS.CERTS_PATH, `${domain.name}.key`), privateKey);
      if (chain) {
        await fs.writeFile(path.join(SSL_CONSTANTS.CERTS_PATH, `${domain.name}.chain.crt`), chain);
      }
      logger.info(`Certificate files written for ${domain.name}`);
    } catch (error) {
      logger.error(`Failed to write certificate files for ${domain.name}:`, error);
    }

    // Update domain SSL expiry (DO NOT auto-enable SSL)
    await sslRepository.updateDomainSSLExpiry(domainId, certInfo.validTo);

    // Log activity
    await this.logActivity(
      userId,
      `Uploaded manual SSL certificate for ${domain.name}`,
      ip,
      userAgent,
      true
    );

    logger.info(`Manual SSL certificate uploaded for ${domain.name} by user ${userId}`);

    return cert;
  }

  /**
   * Update SSL certificate
   */
  async updateCertificate(
    id: string,
    dto: UpdateSSLDto,
    userId: string,
    ip: string,
    userAgent: string
  ): Promise<SSLCertificateWithDomain> {
    const { certificate, privateKey, chain, autoRenew } = dto;

    const cert = await sslRepository.findById(id);
    if (!cert) {
      throw new Error('SSL certificate not found');
    }

    // If certificate is being updated, parse it to get real info
    let updateData: any = {
      ...(privateKey && { privateKey }),
      ...(chain !== undefined && { chain }),
      ...(autoRenew !== undefined && { autoRenew }),
      updatedAt: new Date(),
    };

    if (certificate) {
      try {
        const certInfo = await acmeService.parseCertificate(certificate);
        logger.info(`Parsed updated certificate: CN=${certInfo.commonName}, Valid: ${certInfo.validFrom.toISOString()} - ${certInfo.validTo.toISOString()}`);
        
        const status = this.calculateStatus(certInfo.validTo);
        
        updateData = {
          ...updateData,
          certificate,
          commonName: certInfo.commonName,
          sans: certInfo.sans,
          issuer: certInfo.issuer,
          subject: certInfo.subject,
          subjectDetails: certInfo.subjectDetails,
          issuerDetails: certInfo.issuerDetails,
          serialNumber: certInfo.serialNumber,
          validFrom: certInfo.validFrom,
          validTo: certInfo.validTo,
          status,
        };

        // Update domain SSL expiry
        await sslRepository.updateDomainSSLExpiry(cert.domainId, certInfo.validTo);
      } catch (error: any) {
        logger.error('Failed to parse updated certificate:', error);
        throw new Error(`Invalid certificate format: ${error.message}`);
      }
    }

    // Update certificate
    const updatedCert = await sslRepository.update(id, updateData);

    // Update certificate files if changed
    if (certificate || privateKey || chain) {
      try {
        if (certificate) {
          await fs.writeFile(
            path.join(SSL_CONSTANTS.CERTS_PATH, `${cert.domain.name}.crt`),
            certificate
          );
        }
        if (privateKey) {
          await fs.writeFile(
            path.join(SSL_CONSTANTS.CERTS_PATH, `${cert.domain.name}.key`),
            privateKey
          );
        }
        if (chain) {
          await fs.writeFile(
            path.join(SSL_CONSTANTS.CERTS_PATH, `${cert.domain.name}.chain.crt`),
            chain
          );
        }
      } catch (error) {
        logger.error(`Failed to update certificate files for ${cert.domain.name}:`, error);
      }
    }

    // Log activity
    await this.logActivity(
      userId,
      `Updated SSL certificate for ${cert.domain.name}`,
      ip,
      userAgent,
      true
    );

    logger.info(`SSL certificate updated for ${cert.domain.name} by user ${userId}`);

    return updatedCert;
  }

  /**
   * Delete SSL certificate and regenerate nginx so site configs never
   * keep referencing removed /etc/nginx/ssl/*.crt files.
   */
  async deleteCertificate(
    id: string,
    userId: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    const cert = await sslRepository.findById(id);
    if (!cert) {
      throw new Error('SSL certificate not found');
    }

    const domainName = cert.domain.name;
    const domainId = cert.domainId;

    // Delete certificate files
    try {
      await fs.unlink(path.join(SSL_CONSTANTS.CERTS_PATH, `${domainName}.crt`)).catch(() => {});
      await fs.unlink(path.join(SSL_CONSTANTS.CERTS_PATH, `${domainName}.key`)).catch(() => {});
      await fs.unlink(path.join(SSL_CONSTANTS.CERTS_PATH, `${domainName}.chain.crt`)).catch(() => {});
    } catch (error) {
      logger.error(`Failed to delete certificate files for ${domainName}:`, error);
    }

    // Update domain SSL status before removing the cert row
    await sslRepository.updateDomainSSLStatus(domainId, false, null);

    // Delete certificate from database
    await sslRepository.delete(id);

    // Regenerate nginx without HTTPS for this domain (critical — otherwise nginx -t fails)
    try {
      const domain = await domainsRepository.findById(domainId);
      if (domain) {
        await nginxConfigService.generateConfig({
          ...domain,
          sslEnabled: false,
          sslCertificate: null,
        });
        if (domain.status === 'active') {
          await nginxConfigService.enableConfig(domain.name);
        }
        const reloaded = await nginxReloadService.autoReload(true);
        if (!reloaded) {
          logger.warn(`Nginx reload after deleting SSL for ${domainName} failed`);
        }
      }
    } catch (error) {
      logger.error(`Failed to regenerate nginx after deleting SSL for ${domainName}:`, error);
      throw new Error(
        `Certificate deleted but nginx config could not be updated for ${domainName}. Restart the API or repair SSL configs. (${(error as Error).message})`
      );
    }

    // Log activity
    await this.logActivity(
      userId,
      `Deleted SSL certificate for ${domainName}`,
      ip,
      userAgent,
      true
    );

    logger.info(`SSL certificate deleted for ${domainName} by user ${userId}`);
  }

  /**
   * Renew SSL certificate via ACME. Manual renew is always allowed (force).
   */
  async renewCertificate(
    id: string,
    userId: string,
    ip: string,
    userAgent: string,
    options: { force?: boolean } = {}
  ): Promise<SSLCertificateWithDomain> {
    const cert = await sslRepository.findById(id);
    if (!cert) {
      throw new Error('SSL certificate not found');
    }

    const storedProvider = normalizeAcmeProvider((cert as any).acmeProvider);
    if (!isAcmeRenewable(cert.issuer, (cert as any).acmeProvider)) {
      throw new Error(
        `Only Let's Encrypt and ZeroSSL certificates can be renewed automatically. Current issuer: ${cert.issuer}`
      );
    }

    const force = options.force !== false;
    let provider: AcmeProviderId =
      storedProvider || inferProviderFromIssuer(cert.issuer) || acmeService.getDefaultCA();

    const systemConfig = await prisma.systemConfig.findFirst();
    const eabKid = systemConfig?.zerosslEabKid || undefined;
    const eabHmacKey = systemConfig?.zerosslEabHmacKey || undefined;
    const hasZerosslEab = Boolean(eabKid && eabHmacKey);

    // Pre-update installs issued via ZeroSSL; without EAB renew cannot succeed — use Let's Encrypt
    if (provider === 'zerossl' && !hasZerosslEab) {
      logger.warn(
        `ZeroSSL EAB not configured; renewing ${cert.domain.name} with Let's Encrypt instead`
      );
      provider = 'letsencrypt';
    }

    if (provider === 'zerossl' && !hasZerosslEab) {
      throw new Error(
        'ZeroSSL requires EAB credentials. Add them under Fleet → Configuration, or re-issue with Let\'s Encrypt.'
      );
    }

    logger.info(
      `Renewing ${provider} certificate for ${cert.domain.name} (force=${force})`
    );

    try {
      // Force renew / CA switch: re-issue is more reliable than acme.sh --renew across servers
      const certFiles = force
        ? await acmeService.issueCertificate({
            domain: cert.domain.name,
            email: undefined,
            provider,
            force: true,
            eabKid,
            eabHmacKey,
          })
        : await acmeService.renewCertificate(cert.domain.name, {
            provider,
            force,
            eabKid,
            eabHmacKey,
          });

      const certInfo = await acmeService.parseCertificate(certFiles.certificate);

      const updateData: any = {
        certificate: certFiles.certificate,
        privateKey: certFiles.privateKey,
        chain: certFiles.chain,
        commonName: certInfo.commonName,
        sans: certInfo.sans,
        issuer: certInfo.issuer,
        validFrom: certInfo.validFrom,
        validTo: certInfo.validTo,
        status: 'valid',
        acmeProvider: toPrismaAcmeProvider(provider),
        updatedAt: new Date(),
      };

      if (certInfo.subject) updateData.subject = certInfo.subject;
      if (certInfo.subjectDetails) updateData.subjectDetails = certInfo.subjectDetails;
      if (certInfo.issuerDetails) updateData.issuerDetails = certInfo.issuerDetails;
      if (certInfo.serialNumber) updateData.serialNumber = certInfo.serialNumber;

      const updatedCert = await sslRepository.update(id, updateData);
      await sslRepository.updateDomainSSLExpiry(cert.domainId, updatedCert.validTo);

      try {
        await nginxReloadService.autoReload(true);
      } catch (reloadError) {
        logger.warn(`Nginx reload after SSL renew for ${cert.domain.name} failed:`, reloadError);
      }

      await this.logActivity(
        userId,
        `Renewed SSL certificate for ${cert.domain.name}`,
        ip,
        userAgent,
        true
      );

      logger.info(`SSL certificate renewed for ${cert.domain.name} by user ${userId}`);

      return updatedCert;
    } catch (error: any) {
      logger.error(`Failed to renew certificate for ${cert.domain.name}:`, error);
      await this.logActivity(
        userId,
        `Failed to renew SSL certificate for ${cert.domain.name}: ${error.message}`,
        ip,
        userAgent,
        false
      );
      throw new Error(`Failed to renew SSL certificate: ${error.message}`);
    }
  }

  /**
   * Log activity to database
   */
  private async logActivity(
    userId: string,
    action: string,
    ip: string,
    userAgent: string,
    success: boolean
  ): Promise<void> {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        type: 'config_change',
        ip,
        userAgent,
        success,
      },
    });
  }
}

// Export singleton instance
export const sslService = new SSLService();
