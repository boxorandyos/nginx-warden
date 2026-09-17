import logger from '../../../utils/logger';
import { sslRepository } from '../ssl.repository';
import { acmeService } from './acme.service';
import {
  inferProviderFromIssuer,
  isAcmeRenewable,
  normalizeAcmeProvider,
  toPrismaAcmeProvider,
} from '../ssl-issuer.util';
import prisma from '../../../config/database';
import { nginxReloadService } from '../../domains/services/nginx-reload.service';

/**
 * SSL Auto-Renew Scheduler
 * Checks hourly and renews ACME certs that expire within the threshold.
 */
class SSLSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 3600000;
  private renewThresholdDays: number = 30;
  private running = false;

  async checkAndRenewExpiringCertificates(): Promise<void> {
    if (this.running) {
      logger.info('[Auto-Renew] Previous check still running, skipping this tick');
      return;
    }
    this.running = true;

    try {
      logger.info('🔍 Checking for expiring SSL certificates...');

      const certificates = await sslRepository.findAll();
      logger.info(`Found ${certificates.length} SSL certificate(s) in database`);

      const now = new Date();
      const thresholdDate = new Date(
        now.getTime() + this.renewThresholdDays * 24 * 60 * 60 * 1000
      );
      const systemConfig = await prisma.systemConfig.findFirst();

      for (const cert of certificates) {
        if (!cert.autoRenew) {
          logger.info(
            `⏭️  Certificate ${cert.id} (${cert.domain.name}) has autoRenew disabled, skipping...`
          );
          continue;
        }

        if (!isAcmeRenewable(cert.issuer, (cert as any).acmeProvider)) {
          logger.info(
            `⏭️  Certificate ${cert.id} (${cert.domain.name}) has issuer "${cert.issuer}" which doesn't support auto-renewal, skipping...`
          );
          continue;
        }

        if (cert.validTo <= thresholdDate) {
          const daysUntilExpiry = Math.floor(
            (cert.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          logger.info(
            `🔄 Certificate for ${cert.domain.name} (issuer: ${cert.issuer}) expires in ${daysUntilExpiry} days, attempting renewal...`
          );

          try {
            await this.renewCertificate(cert.id, cert.domain.name, {
              issuer: cert.issuer,
              acmeProvider: (cert as any).acmeProvider,
              eabKid: systemConfig?.zerosslEabKid || undefined,
              eabHmacKey: systemConfig?.zerosslEabHmacKey || undefined,
            });
          } catch (error) {
            logger.error(
              `❌ Failed to auto-renew certificate ${cert.id} (${cert.domain.name}):`,
              error
            );
          }
        } else {
          const daysUntilExpiry = Math.floor(
            (cert.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          logger.info(
            `✅ Certificate for ${cert.domain.name} (issuer: ${cert.issuer}) is valid for ${daysUntilExpiry} more days`
          );
        }
      }

      logger.info('✅ SSL certificate check completed');
    } catch (error) {
      logger.error('❌ Error in checkAndRenewExpiringCertificates:', error);
    } finally {
      this.running = false;
    }
  }

  private async renewCertificate(
    certId: string,
    domainName: string,
    meta: {
      issuer?: string;
      acmeProvider?: string | null;
      eabKid?: string;
      eabHmacKey?: string;
    }
  ): Promise<void> {
    try {
      logger.info(`[Auto-Renew] Starting renewal for ${domainName}`);

      const provider =
        normalizeAcmeProvider(meta.acmeProvider) ||
        inferProviderFromIssuer(meta.issuer) ||
        acmeService.getDefaultCA();

      // Our 30-day policy already decided this cert is due; force so acme.sh
      // does not skip based on its own (often 60-day) remaining window.
      const certFiles = await acmeService.renewCertificate(domainName, {
        provider,
        force: true,
        eabKid: meta.eabKid,
        eabHmacKey: meta.eabHmacKey,
      });

      const certInfo = await acmeService.parseCertificate(certFiles.certificate);

      await sslRepository.update(certId, {
        certificate: certFiles.certificate,
        privateKey: certFiles.privateKey,
        chain: certFiles.chain,
        commonName: certInfo.commonName,
        sans: certInfo.sans,
        issuer: certInfo.issuer,
        subject: certInfo.subject,
        subjectDetails: certInfo.subjectDetails,
        issuerDetails: certInfo.issuerDetails,
        serialNumber: certInfo.serialNumber,
        validFrom: certInfo.validFrom,
        validTo: certInfo.validTo,
        status: 'valid',
        acmeProvider: toPrismaAcmeProvider(provider),
        updatedAt: new Date(),
      });

      const cert = await sslRepository.findById(certId);
      if (cert) {
        await sslRepository.updateDomainSSLExpiry(cert.domainId, certInfo.validTo);
      }

      try {
        await nginxReloadService.autoReload(true);
      } catch (reloadError) {
        logger.warn(`[Auto-Renew] Nginx reload after renew of ${domainName} failed:`, reloadError);
      }

      logger.info(
        `[Auto-Renew] ✅ Successfully renewed certificate for ${domainName}, valid until ${certInfo.validTo.toISOString()}`
      );
    } catch (error: any) {
      const errorMsg = error.message || error.toString();

      if (errorMsg.includes('Rate limited') || errorMsg.includes('retryafter')) {
        logger.warn(
          `[Auto-Renew] ⏳ Certificate renewal for ${domainName} is rate limited, will retry in next cycle`
        );
        return;
      }

      if (errorMsg.includes('not yet due for renewal')) {
        logger.info(`[Auto-Renew] ℹ️  Certificate for ${domainName} is not yet due for renewal`);
        return;
      }

      logger.error(`[Auto-Renew] ❌ Failed to renew certificate for ${domainName}:`, error.message);

      try {
        await sslRepository.update(certId, {
          status: 'expiring',
          updatedAt: new Date(),
        });
      } catch (updateError) {
        logger.error('Failed to update certificate status:', updateError);
      }

      throw error;
    }
  }

  start(checkIntervalMs: number = 3600000, renewThresholdDays: number = 30): NodeJS.Timeout {
    if (this.intervalId) {
      logger.warn('SSL auto-renew scheduler is already running');
      return this.intervalId;
    }

    this.checkIntervalMs = checkIntervalMs;
    this.renewThresholdDays = renewThresholdDays;

    logger.info(
      `Starting SSL auto-renew scheduler (check interval: ${checkIntervalMs}ms, renew threshold: ${renewThresholdDays} days)`
    );

    this.checkAndRenewExpiringCertificates().catch((error) => {
      logger.error('Error in initial SSL certificate check:', error);
    });

    this.intervalId = setInterval(() => {
      this.checkAndRenewExpiringCertificates().catch((error) => {
        logger.error('Error in scheduled SSL certificate check:', error);
      });
    }, checkIntervalMs);

    logger.info('✅ SSL auto-renew scheduler started successfully');

    return this.intervalId;
  }

  stop(timerId?: NodeJS.Timeout): void {
    const timerToStop = timerId || this.intervalId;

    if (timerToStop) {
      clearInterval(timerToStop);
      this.intervalId = null;
      logger.info('SSL auto-renew scheduler stopped');
    } else {
      logger.warn('No SSL auto-renew scheduler to stop');
    }
  }

  getStatus(): {
    isRunning: boolean;
    checkIntervalMs: number;
    renewThresholdDays: number;
  } {
    return {
      isRunning: this.intervalId !== null,
      checkIntervalMs: this.checkIntervalMs,
      renewThresholdDays: this.renewThresholdDays,
    };
  }

  async triggerCheck(): Promise<void> {
    logger.info('Manually triggering SSL certificate check...');
    await this.checkAndRenewExpiringCertificates();
  }
}

export const sslSchedulerService = new SSLSchedulerService();

export { SSLSchedulerService };
