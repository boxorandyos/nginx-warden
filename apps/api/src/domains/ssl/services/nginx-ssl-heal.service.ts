import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import logger from '../../../utils/logger';
import prisma from '../../../config/database';
import { nginxConfigService } from '../../domains/services/nginx-config.service';
import { nginxReloadService } from '../../domains/services/nginx-reload.service';
import { SSL_CONSTANTS } from '../../ssl/ssl.types';
import { PATHS } from '../../../shared/constants/paths.constants';

const execFileAsync = promisify(execFile);

/**
 * Repair nginx site configs that still reference deleted/missing SSL files.
 * Also restores cert files from the DB when a certificate row still exists.
 *
 * Important: per-domain nginx -t + "restore backup on failure" must NOT run during
 * heal — restoring the previous file brings back the broken missing-cert config.
 */
export class NginxSslHealService {
  async repair(): Promise<{
    disabledSsl: number;
    certsWritten: number;
    domainsRegenerated: number;
    sitesDisabledMissingCert: number;
    reloadOk: boolean;
  }> {
    let disabledSsl = 0;
    let sitesDisabledMissingCert = 0;

    // Domains with SSL toggled on but no certificate → turn SSL off
    const orphaned = await prisma.domain.findMany({
      where: { sslEnabled: true, sslCertificate: { is: null } },
      select: { id: true, name: true },
    });

    for (const domain of orphaned) {
      await prisma.domain.update({
        where: { id: domain.id },
        data: { sslEnabled: false, sslExpiry: null },
      });
      disabledSsl++;
      logger.warn(
        `[SSL-HEAL] Disabled SSL for ${domain.name} (enabled in DB but certificate missing)`
      );
    }

    await fs.mkdir(SSL_CONSTANTS.CERTS_PATH, { recursive: true });

    const certs = await prisma.sSLCertificate.findMany({
      include: { domain: { select: { name: true } } },
    });

    let certsWritten = 0;
    for (const cert of certs) {
      const name = cert.domain?.name;
      if (!name) continue;
      try {
        const fullchain = cert.chain
          ? `${cert.certificate.trim()}\n${cert.chain.trim()}\n`
          : cert.certificate;
        await fs.writeFile(path.join(SSL_CONSTANTS.CERTS_PATH, `${name}.crt`), fullchain);
        await fs.writeFile(path.join(SSL_CONSTANTS.CERTS_PATH, `${name}.key`), cert.privateKey);
        if (cert.chain) {
          await fs.writeFile(path.join(SSL_CONSTANTS.CERTS_PATH, `${name}.chain.crt`), cert.chain);
        }
        certsWritten++;
      } catch (error) {
        logger.error(`[SSL-HEAL] Failed to write SSL files for ${name}:`, error);
      }
    }

    const domains = await prisma.domain.findMany({
      include: {
        upstreams: true,
        loadBalancer: true,
        sslCertificate: true,
        accessLists: { include: { accessList: true } },
      },
    });

    let domainsRegenerated = 0;
    for (const domain of domains) {
      try {
        // Effective SSL requires both the flag and a certificate row + files on disk
        const hasCert = Boolean(domain.sslCertificate);
        const certPath = path.join(SSL_CONSTANTS.CERTS_PATH, `${domain.name}.crt`);
        let certFileExists = false;
        if (hasCert) {
          try {
            await fs.access(certPath);
            certFileExists = true;
          } catch {
            certFileExists = false;
          }
        }
        const sslActive = Boolean(domain.sslEnabled && hasCert && certFileExists);
        if (domain.sslEnabled && !sslActive) {
          await prisma.domain.update({
            where: { id: domain.id },
            data: { sslEnabled: false, sslExpiry: null },
          });
          disabledSsl++;
        }

        const effective = {
          ...domain,
          sslEnabled: sslActive,
          sslCertificate: sslActive ? domain.sslCertificate : null,
        };
        // Defer nginx -t so we never restore a broken backup mid-heal
        await nginxConfigService.generateConfig(effective as any, { deferValidation: true });
        domainsRegenerated++;
      } catch (error) {
        logger.error(`[SSL-HEAL] Failed to regenerate nginx config for ${domain.name}:`, error);
      }
    }

    // Belt-and-suspenders: disable any remaining enabled sites that still point at missing PEMs
    sitesDisabledMissingCert = await this.disableSitesWithMissingCertFiles();

    // Prefer the shell repair script when present (same logic as update.sh)
    try {
      const script = path.resolve(process.cwd(), '..', '..', 'scripts', 'repair-nginx-missing-certs.sh');
      await fs.access(script);
      await execFileAsync('bash', [script], { timeout: 30000 });
    } catch {
      // Script may not exist in all layouts; Node scan above still ran
    }

    const reload = await nginxReloadService.reload();
    if (!reload.success) {
      logger.warn(`[SSL-HEAL] Nginx reload after heal: ${reload.error || 'failed'}`);
      // Last resort: disable any still-broken sites and try once more
      const extra = await this.disableSitesWithMissingCertFiles();
      sitesDisabledMissingCert += extra;
      const retry = await nginxReloadService.reload();
      if (!retry.success) {
        logger.warn(`[SSL-HEAL] Nginx reload retry failed: ${retry.error || 'failed'}`);
      } else {
        logger.info(`[SSL-HEAL] Nginx reload succeeded after disabling ${extra} more broken site(s)`);
      }
      return {
        disabledSsl,
        certsWritten,
        domainsRegenerated,
        sitesDisabledMissingCert,
        reloadOk: retry.success,
      };
    }

    logger.info(
      `[SSL-HEAL] Repaired SSL/nginx (disabledSsl=${disabledSsl}, certs=${certsWritten}, domains=${domainsRegenerated}, sitesDisabledMissingCert=${sitesDisabledMissingCert})`
    );

    return {
      disabledSsl,
      certsWritten,
      domainsRegenerated,
      sitesDisabledMissingCert,
      reloadOk: true,
    };
  }

  /**
   * Scan sites-enabled for ssl_certificate paths that do not exist on disk and
   * remove those enabled entries so nginx -t can succeed.
   */
  async disableSitesWithMissingCertFiles(): Promise<number> {
    const enabledDir = PATHS.NGINX.SITES_ENABLED;
    let disabled = 0;
    let entries: string[] = [];
    try {
      entries = await fs.readdir(enabledDir);
    } catch {
      return 0;
    }

    for (const name of entries) {
      if (!name.endsWith('.conf')) continue;
      const confPath = path.join(enabledDir, name);
      try {
        const content = await fs.readFile(confPath, 'utf8');
        const paths = [...content.matchAll(/^\s*ssl_certificate(?:_key)?\s+(\S+);/gm)].map(
          (m) => m[1].replace(/^"|"$/g, '')
        );
        let missing = false;
        for (const p of paths) {
          try {
            await fs.access(p);
          } catch {
            missing = true;
            logger.warn(`[SSL-HEAL] ${name} references missing file: ${p}`);
            break;
          }
        }
        if (missing) {
          await fs.unlink(confPath).catch(async () => {
            // If it's a regular file, rename aside
            const dest = `${confPath}.disabled-missing-cert`;
            await fs.rename(confPath, dest).catch(() => {});
          });
          disabled++;
          logger.warn(`[SSL-HEAL] Disabled ${name} (missing certificate file)`);
        }
      } catch (error) {
        logger.warn(`[SSL-HEAL] Could not inspect ${name}:`, error);
      }
    }
    return disabled;
  }
}

export const nginxSslHealService = new NginxSslHealService();
