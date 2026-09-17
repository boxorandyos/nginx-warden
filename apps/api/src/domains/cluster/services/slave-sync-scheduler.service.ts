import axios from 'axios';
import logger from '../../../utils/logger';
import { SystemConfigRepository } from '../../system/system-config.repository';
import { nodeSyncService } from './node-sync.service';

/**
 * Slave-side pull scheduler. Master-only installs never start this loop.
 */
class SlaveSyncSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private inFlight = false;
  private repository = new SystemConfigRepository();

  async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  async start(): Promise<void> {
    if (this.intervalId) {
      return;
    }

    let config;
    try {
      config = await this.repository.getSystemConfig();
    } catch (error) {
      logger.warn('[SLAVE-SYNC] Cannot read system config; scheduler not started', error);
      return;
    }

    if (config.nodeMode !== 'slave') {
      logger.info('[SLAVE-SYNC] Node is master (or not slave); automatic pull scheduler idle');
      return;
    }

    if (!config.connected || !config.masterHost || !config.masterApiKey) {
      logger.info('[SLAVE-SYNC] Slave is not connected to a master; scheduler idle');
      return;
    }

    const intervalMs = Math.max(10, config.syncInterval || 60) * 1000;

    logger.info(
      `[SLAVE-SYNC] Starting automatic pull from master ${config.masterHost}:${config.masterPort} every ${intervalMs}ms`
    );

    // Immediate sync, then interval
    this.pullOnce().catch((error) => {
      logger.error('[SLAVE-SYNC] Initial pull failed:', error);
    });

    this.intervalId = setInterval(() => {
      this.pullOnce().catch((error) => {
        logger.error('[SLAVE-SYNC] Scheduled pull failed:', error);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[SLAVE-SYNC] Automatic pull scheduler stopped');
    }
  }

  /**
   * Pull config from master using the slave API key (no user JWT).
   */
  async pullOnce(): Promise<{
    imported: boolean;
    masterHash: string;
    changesApplied: number;
  } | null> {
    if (this.inFlight) {
      logger.info('[SLAVE-SYNC] Pull already in progress, skipping tick');
      return null;
    }
    this.inFlight = true;

    try {
      const config = await this.repository.getSystemConfig();
      if (config.nodeMode !== 'slave' || !config.connected) {
        this.stop();
        return null;
      }
      if (!config.masterHost || !config.masterApiKey) {
        return null;
      }

      const masterUrl = `http://${config.masterHost}:${config.masterPort || 3001}/api/node-sync/export`;
      const response = await axios.get(masterUrl, {
        headers: { 'X-Slave-API-Key': config.masterApiKey },
        timeout: 30000,
      });

      if (!response.data?.success || !response.data.data?.hash || !response.data.data?.config) {
        throw new Error(response.data?.message || 'Invalid export from master');
      }

      const { hash, config: masterConfig } = response.data.data;
      const result = await nodeSyncService.importFromMaster(hash, masterConfig);

      await this.repository.updateLastSyncHash(config.id, hash);

      logger.info('[SLAVE-SYNC] Pull completed', {
        imported: result.imported,
        changes: result.changes,
        hash,
      });

      return {
        imported: result.imported,
        masterHash: hash,
        changesApplied: result.changes,
      };
    } catch (error: any) {
      logger.error('[SLAVE-SYNC] Pull failed:', error.message || error);
      throw error;
    } finally {
      this.inFlight = false;
    }
  }
}

export const slaveSyncSchedulerService = new SlaveSyncSchedulerService();
