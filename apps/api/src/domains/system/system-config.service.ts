import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import logger from '../../utils/logger';
import { SystemConfigRepository } from './system-config.repository';
import { SystemConfig, NodeMode } from './system.types';
import { ValidationError, NotFoundError } from '../../shared/errors/app-error';
import {
  setPortalAccessOriginsCache,
  writePortalHostsFile,
} from './portal-access-sync.service';

const execAsync = promisify(exec);

/**
 * System Config service - Handles all system configuration business logic
 */
export class SystemConfigService {
  private repository: SystemConfigRepository;

  constructor() {
    this.repository = new SystemConfigRepository();
  }

  /**
   * Get system configuration
   */
  async getSystemConfig(): Promise<SystemConfig> {
    return this.repository.getSystemConfig();
  }

  /**
   * Portal UI base URLs (CORS + Vite allowedHosts). Each value must be a valid http(s) origin (e.g. http://10.0.0.1:8080).
   */
  async updatePortalAccessOrigins(rawOrigins: unknown): Promise<SystemConfig> {
    if (!Array.isArray(rawOrigins)) {
      throw new ValidationError('portalAccessOrigins must be an array of URL strings');
    }
    const normalized = [
      ...new Set(
        rawOrigins
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      ),
    ];

    for (const o of normalized) {
      let u: URL;
      try {
        u = new URL(o);
      } catch {
        throw new ValidationError(`Invalid URL: ${o}`);
      }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new ValidationError(`URL must use http or https: ${o}`);
      }
    }

    const config = await this.repository.getSystemConfig();
    const updated = await this.repository.updatePortalAccessOrigins(config.id, normalized);
    setPortalAccessOriginsCache(normalized);
    try {
      writePortalHostsFile(normalized);
    } catch (e) {
      logger.warn(
        'Could not write portal-allowed-hosts.json for Vite; check PORTAL_ALLOWED_HOSTS_FILE or filesystem permissions.',
        e
      );
    }
    return updated;
  }

  /**
   * Restart the systemd unit that serves the admin UI (e.g. Vite preview). Requires permission to run systemctl (typically API runs as root).
   * Override unit with FRONTEND_SYSTEMD_UNIT (default: nginx-warden-frontend).
   */
  async restartFrontendService(): Promise<void> {
    const raw = process.env.FRONTEND_SYSTEMD_UNIT || 'nginx-warden-frontend';
    const unit = raw.replace(/\.service$/i, '');
    if (!/^[a-zA-Z0-9_.@-]+$/.test(unit)) {
      throw new ValidationError('Invalid FRONTEND_SYSTEMD_UNIT');
    }
    try {
      await execAsync(`systemctl restart ${unit}`, {
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      });
      logger.info(`systemctl restart ${unit} completed`);
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message?: string };
      const detail = [err.stderr, err.stdout].filter(Boolean).join('\n').trim() || err.message;
      logger.error(`systemctl restart ${unit} failed`, e);
      throw new Error(detail || 'systemctl restart failed');
    }
  }

  /**
   * Update node mode
   */
  async updateNodeMode(nodeMode: string): Promise<SystemConfig> {
    if (!['master', 'slave'].includes(nodeMode)) {
      throw new ValidationError('Invalid node mode. Must be "master" or "slave"');
    }

    let config = await this.repository.getSystemConfig();

    if (!config) {
      // Create new config if doesn't exist
      config = await this.repository.createSystemConfig(nodeMode as NodeMode);
    } else {
      // Update existing config
      const resetSlaveConnection = nodeMode === 'master';
      config = await this.repository.updateNodeMode(
        config.id,
        nodeMode as NodeMode,
        resetSlaveConnection
      );
    }

    return config;
  }

  /**
   * Connect to master node
   */
  async connectToMaster(
    masterHost: string,
    masterPort: number,
    masterApiKey: string
  ): Promise<SystemConfig> {
    if (!masterHost || !masterPort || !masterApiKey) {
      throw new ValidationError('Master host, port, and API key are required');
    }

    const config = await this.repository.getSystemConfig();

    if (!config) {
      throw new NotFoundError('System config not found. Please set node mode first.');
    }

    if (config.nodeMode !== 'slave') {
      throw new ValidationError('Cannot connect to master. Node mode must be "slave".');
    }

    // Test connection to master
    try {
      logger.info('Testing connection to master...', { masterHost, masterPort });

      const response = await axios.get(
        `http://${masterHost}:${masterPort}/api/slave/health`,
        {
          headers: {
            'X-API-Key': masterApiKey,
          },
          timeout: 10000,
        }
      );

      if (!response.data.success) {
        throw new Error('Master health check failed');
      }

      // Connection successful, update config
      const updatedConfig = await this.repository.updateMasterConnection(
        config.id,
        masterHost,
        masterPort,
        masterApiKey,
        true
      );

      logger.info('Successfully connected to master', {
        masterHost,
        masterPort,
      });

      return updatedConfig;
    } catch (connectionError: any) {
      // Connection failed, update config with error
      const errorMessage =
        connectionError.response?.data?.message ||
        connectionError.message ||
        'Failed to connect to master';

      const updatedConfig = await this.repository.updateMasterConnection(
        config.id,
        masterHost,
        masterPort,
        masterApiKey,
        false,
        errorMessage
      );

      logger.error('Failed to connect to master:', {
        error: errorMessage,
        masterHost,
        masterPort,
      });

      throw new ValidationError(errorMessage);
    }
  }

  /**
   * Disconnect from master node
   */
  async disconnectFromMaster(): Promise<SystemConfig> {
    const config = await this.repository.getSystemConfig();

    if (!config) {
      throw new NotFoundError('System config not found');
    }

    return this.repository.disconnectFromMaster(config.id);
  }

  /**
   * Test connection to master
   */
  async testMasterConnection(): Promise<{
    latency: number;
    masterVersion: string;
    masterStatus: string;
  }> {
    const config = await this.repository.getSystemConfig();

    if (!config) {
      throw new NotFoundError('System config not found');
    }

    if (!config.masterHost || !config.masterPort || !config.masterApiKey) {
      throw new ValidationError('Master connection not configured');
    }

    try {
      // Test connection
      const startTime = Date.now();
      const response = await axios.get(
        `http://${config.masterHost}:${config.masterPort}/api/slave/health`,
        {
          headers: {
            'X-API-Key': config.masterApiKey,
          },
          timeout: 10000,
        }
      );
      const latency = Date.now() - startTime;

      // Update config with successful connection
      await this.repository.updateConnectionStatus(config.id, true);

      return {
        latency,
        masterVersion: response.data.version,
        masterStatus: response.data.status,
      };
    } catch (error: any) {
      logger.error('Test master connection error:', error);

      // Update config with error
      await this.repository.updateConnectionStatus(
        config.id,
        false,
        error.message
      );

      throw new ValidationError(
        error.response?.data?.message || error.message || 'Connection test failed'
      );
    }
  }

  /**
   * Sync configuration from master
   */
  async syncWithMaster(authToken: string): Promise<{
    imported: boolean;
    masterHash: string;
    slaveHash: string | null;
    changesApplied: number;
    details?: any;
    lastSyncAt: string;
  }> {
    logger.info('========== SYNC WITH MASTER CALLED ==========');

    const config = await this.repository.getSystemConfig();

    if (!config) {
      throw new NotFoundError('System config not found');
    }

    if (config.nodeMode !== 'slave') {
      throw new ValidationError('Cannot sync. Node mode must be "slave".');
    }

    if (!config.connected || !config.masterHost || !config.masterApiKey) {
      throw new ValidationError('Not connected to master. Please connect first.');
    }

    logger.info('Starting sync from master...', {
      masterHost: config.masterHost,
      masterPort: config.masterPort,
    });

    // Download config from master using new node-sync API
    const masterUrl = `http://${config.masterHost}:${config.masterPort || 3001}/api/node-sync/export`;

    const response = await axios.get(masterUrl, {
      headers: {
        'X-Slave-API-Key': config.masterApiKey,
      },
      timeout: 30000,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to export config from master');
    }

    // Basic validation: check if response has required structure
    if (!response.data.data || !response.data.data.hash || !response.data.data.config) {
      throw new ValidationError('Invalid response structure from master');
    }

    const { hash: masterHash, config: masterConfig } = response.data.data;

    // Calculate CURRENT hash of slave's config (to detect data loss)
    const slaveCurrentConfigResponse = await axios.get(
      `http://localhost:${process.env.PORT || 3001}/api/node-sync/current-hash`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const slaveCurrentHash = slaveCurrentConfigResponse.data.data?.hash || null;

    logger.info('Comparing slave current config with master', {
      masterHash,
      slaveCurrentHash,
      lastSyncHash: config.lastSyncHash || 'none',
    });

    // Compare CURRENT slave hash with master hash
    if (slaveCurrentHash && slaveCurrentHash === masterHash) {
      logger.info('Config identical (hash match), skipping import');

      // Update lastConnectedAt and lastSyncHash
      await this.repository.updateLastSyncHash(config.id, masterHash);

      return {
        imported: false,
        masterHash,
        slaveHash: slaveCurrentHash,
        changesApplied: 0,
        lastSyncAt: new Date().toISOString(),
      };
    }

    // Hash different - Force sync (data loss or master updated)
    logger.info('Config mismatch detected, force syncing...', {
      masterHash,
      slaveCurrentHash: slaveCurrentHash || 'null',
      reason: !slaveCurrentHash ? 'slave_empty' : 'data_mismatch',
    });

    // Call import API (internal call to ourselves)
    const importResponse = await axios.post(
      `http://localhost:${process.env.PORT || 3001}/api/node-sync/import`,
      {
        hash: masterHash,
        config: masterConfig,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!importResponse.data.success) {
      throw new Error(importResponse.data.message || 'Import failed');
    }

    const importData = importResponse.data.data;

    // Update lastSyncHash
    await this.repository.updateLastSyncHash(config.id, masterHash);

    logger.info(`Sync completed successfully. ${importData.changes} changes applied.`);

    return {
      imported: true,
      masterHash,
      slaveHash: slaveCurrentHash,
      changesApplied: importData.changes,
      details: importData.details,
      lastSyncAt: new Date().toISOString(),
    };
  }
}
