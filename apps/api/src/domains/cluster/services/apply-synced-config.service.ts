import * as fs from 'fs/promises';
import * as path from 'path';
import logger from '../../../utils/logger';
import prisma from '../../../config/database';
import { nginxConfigService } from '../../domains/services/nginx-config.service';
import { nginxReloadService } from '../../domains/services/nginx-reload.service';
import { SSL_CONSTANTS } from '../../ssl/ssl.types';

/**
 * After a slave imports DB state from the master, write certs and regenerate nginx.
 */
export class ApplySyncedConfigService {
  async applyLocalNginxAndCerts(): Promise<{ domains: number; certs: number }> {
    const certs = await prisma.sSLCertificate.findMany({
      include: { domain: { select: { name: true } } },
    });

    await fs.mkdir(SSL_CONSTANTS.CERTS_PATH, { recursive: true });

    let certCount = 0;
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
        certCount++;
      } catch (error) {
        logger.error(`[SYNC-APPLY] Failed to write SSL files for ${name}:`, error);
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

    let domainCount = 0;
    for (const domain of domains) {
      try {
        await nginxConfigService.generateConfig(domain as any);
        if (domain.status === 'active') {
          await nginxConfigService.enableConfig(domain.name);
        }
        domainCount++;
      } catch (error) {
        logger.error(`[SYNC-APPLY] Failed to generate nginx config for ${domain.name}:`, error);
      }
    }

    const reload = await nginxReloadService.reload();
    if (!reload.success) {
      logger.warn(`[SYNC-APPLY] Nginx reload after sync: ${reload.error || 'failed'}`);
    } else {
      logger.info(`[SYNC-APPLY] Nginx ${reload.method} after applying ${domainCount} domain(s)`);
    }

    return { domains: domainCount, certs: certCount };
  }
}

export const applySyncedConfigService = new ApplySyncedConfigService();
