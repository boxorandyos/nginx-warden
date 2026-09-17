import * as fs from 'fs/promises';
import * as path from 'path';
import logger from '../../../utils/logger';
import prisma from '../../../config/database';
import { nginxConfigService } from '../../domains/services/nginx-config.service';
import { nginxReloadService } from '../../domains/services/nginx-reload.service';
import { SSL_CONSTANTS } from '../../ssl/ssl.types';

/**
 * Repair nginx site configs that still reference deleted/missing SSL files.
 * Also restores cert files from the DB when a certificate row still exists.
 */
export class NginxSslHealService {
  async repair(): Promise<{
    disabledSsl: number;
    certsWritten: number;
    domainsRegenerated: number;
    reloadOk: boolean;
  }> {
    let disabledSsl = 0;

    // Domains with SSL toggled on but no certificate → turn SSL off
    // Prisma 5 optional 1-1: prefer `{ is: null }` (shorthand `null` is also typed OK).
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
        // Effective SSL requires both the flag and a certificate row
        const effective = {
          ...domain,
          sslEnabled: Boolean(domain.sslEnabled && domain.sslCertificate),
        };
        await nginxConfigService.generateConfig(effective as any);
        if (domain.status === 'active') {
          await nginxConfigService.enableConfig(domain.name);
        }
        domainsRegenerated++;
      } catch (error) {
        logger.error(`[SSL-HEAL] Failed to regenerate nginx config for ${domain.name}:`, error);
      }
    }

    const reload = await nginxReloadService.reload();
    if (!reload.success) {
      logger.warn(`[SSL-HEAL] Nginx reload after heal: ${reload.error || 'failed'}`);
    } else {
      logger.info(
        `[SSL-HEAL] Repaired SSL/nginx (disabled=${disabledSsl}, certs=${certsWritten}, domains=${domainsRegenerated})`
      );
    }

    return {
      disabledSsl,
      certsWritten,
      domainsRegenerated,
      reloadOk: reload.success,
    };
  }
}

export const nginxSslHealService = new NginxSslHealService();
