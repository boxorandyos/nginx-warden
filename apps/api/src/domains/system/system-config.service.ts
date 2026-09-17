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
import { applyKeepalivedFromDatabase } from './keepalived-sync.service';

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
   * Strip secrets from API-facing system config (VRRP password).
   */
  private toPublicConfig(config: SystemConfig | null): SystemConfig {
    if (!config) {
      throw new NotFoundError('System config not found');
    }
    const c = config as any;
    const { keepalivedAuthPass, zerosslEabHmacKey, zerosslEabKid, ...rest } = c;
    return {
      ...rest,
      keepalivedAuthPassSet: Boolean(keepalivedAuthPass && String(keepalivedAuthPass).length > 0),
      zerosslEabConfigured: Boolean(zerosslEabKid && zerosslEabHmacKey),
    } as SystemConfig;
  }

  /**
   * Get system configuration
   */
  async getSystemConfig(): Promise<SystemConfig> {
    const c = await this.repository.getSystemConfig();
    return this.toPublicConfig(c);
  }

  /**
   * Portal UI base URLs (CORS + Vite allowedHosts). Each value must be a valid http(s) origin (e.g. http://10.0.0.1:8088).
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
    return this.toPublicConfig(updated);
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

    return this.toPublicConfig(config);
  }

  /**
   * Connect to master node
   */
  async connectToMaster(
    masterHost: string,
    masterPort: number,
    masterApiKey: string,
    syncInterval?: number
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

      if (syncInterval && syncInterval >= 10) {
        await this.repository.updateSyncInterval(updatedConfig.id, syncInterval);
      }

      // Start (or restart) the slave pull scheduler now that we are connected
      try {
        const { slaveSyncSchedulerService } = await import(
          '../cluster/services/slave-sync-scheduler.service'
        );
        await slaveSyncSchedulerService.restart();
      } catch (schedErr) {
        logger.warn('Failed to start slave sync scheduler after connect:', schedErr);
      }

      logger.info('Successfully connected to master', {
        masterHost,
        masterPort,
      });

      const latest = await this.repository.getSystemConfig();
      return this.toPublicConfig(latest);
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

    const d = await this.repository.disconnectFromMaster(config.id);
    try {
      const { slaveSyncSchedulerService } = await import(
        '../cluster/services/slave-sync-scheduler.service'
      );
      slaveSyncSchedulerService.stop();
    } catch {
      // ignore
    }
    return this.toPublicConfig(d);
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
  async syncWithMaster(_authToken?: string): Promise<{
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

    const { slaveSyncSchedulerService } = await import(
      '../cluster/services/slave-sync-scheduler.service'
    );
    const pull = await slaveSyncSchedulerService.pullOnce();
    if (!pull) {
      throw new ValidationError('Sync skipped (already in progress or not connected)');
    }

    return {
      imported: pull.imported,
      masterHash: pull.masterHash,
      slaveHash: null,
      changesApplied: pull.changesApplied,
      lastSyncAt: new Date().toISOString(),
    };
  }

  /**
   * VRRP / Keepalived — master mode only. Writes config and restarts keepalived on this host.
   */
  async updateKeepalivedSettings(body: {
    keepalivedEnabled: boolean;
    keepalivedVirtualIp?: string | null;
    keepalivedVrrpInterface?: string | null;
    keepalivedRouterId?: number;
    keepalivedAuthPass?: string | null;
    keepalivedPriorityMaster?: number;
    keepalivedPriorityBackup?: number;
  }): Promise<SystemConfig> {
    const c = await this.repository.getSystemConfig();
    if (c.nodeMode !== 'master') {
      throw new ValidationError('Keepalived can only be configured when this node is in master mode');
    }

    if (body.keepalivedEnabled) {
      if (!body.keepalivedVirtualIp?.trim() || !body.keepalivedVrrpInterface?.trim()) {
        throw new ValidationError('Virtual IP (CIDR) and network interface are required when HA is enabled');
      }
      const cidr = body.keepalivedVirtualIp.trim();
      if (!/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(cidr)) {
        throw new ValidationError('Virtual IP must be a CIDR, e.g. 192.168.1.50/24');
      }
    }

    const rid = body.keepalivedRouterId ?? c.keepalivedRouterId;
    if (rid < 1 || rid > 255) {
      throw new ValidationError('VRRP virtual router id must be between 1 and 255');
    }

    const pM = body.keepalivedPriorityMaster ?? 150;
    const pB = body.keepalivedPriorityBackup ?? 100;
    if (pM < 1 || pM > 255 || pB < 1 || pB > 255) {
      throw new ValidationError('VRRP priorities must be between 1 and 255');
    }
    if (pM <= pB) {
      throw new ValidationError('Master VRRP priority should be higher than the backup (slave) priority');
    }

    let newAuth: string | undefined;
    if (typeof body.keepalivedAuthPass === 'string' && body.keepalivedAuthPass.length > 0) {
      newAuth = body.keepalivedAuthPass.trim();
      if (newAuth.length > 8) {
        throw new ValidationError('VRRP auth password must be at most 8 characters (Keepalived limitation)');
      }
    }
    const exPass = (c as { keepalivedAuthPass?: string | null }).keepalivedAuthPass;
    const passToStore: string =
      newAuth !== undefined
        ? newAuth
        : exPass && String(exPass).length > 0
          ? String(exPass)
          : 'warden01';

    const updated = await this.repository.updateKeepalived(c.id, {
      keepalivedEnabled: body.keepalivedEnabled,
      keepalivedVirtualIp: body.keepalivedEnabled ? body.keepalivedVirtualIp?.trim() ?? null : null,
      keepalivedVrrpInterface: body.keepalivedEnabled
        ? body.keepalivedVrrpInterface?.trim() ?? null
        : null,
      keepalivedRouterId: rid,
      keepalivedAuthPass: passToStore,
      keepalivedPriorityMaster: pM,
      keepalivedPriorityBackup: pB,
    });

    const applied = await applyKeepalivedFromDatabase();
    if (body.keepalivedEnabled && !applied.ok) {
      logger.warn('[KEEPALIVED] apply after update reported failure', { message: applied.message });
    }

    return this.toPublicConfig(updated);
  }

  /**
   * ACME CA defaults and ZeroSSL EAB credentials.
   */
  async updateAcmeSettings(body: {
    acmeDefaultProvider?: 'letsencrypt' | 'zerossl' | string;
    zerosslEabKid?: string | null;
    zerosslEabHmacKey?: string | null;
    clearZerosslEab?: boolean;
  }): Promise<SystemConfig> {
    const c = await this.repository.getSystemConfig();
    const providerRaw = body.acmeDefaultProvider;
    let acmeDefaultProvider: 'letsencrypt' | 'zerossl' | undefined;
    if (providerRaw) {
      const v = String(providerRaw).toLowerCase().replace(/[\s_-]/g, '');
      if (v === 'zerossl') acmeDefaultProvider = 'zerossl';
      else if (v === 'letsencrypt' || v === 'letsencryptorg' || v === 'le') {
        acmeDefaultProvider = 'letsencrypt';
      } else {
        throw new ValidationError('acmeDefaultProvider must be letsencrypt or zerossl');
      }
    }

    if (acmeDefaultProvider === 'zerossl') {
      const kid = body.zerosslEabKid ?? (c as any).zerosslEabKid;
      const hmac = body.zerosslEabHmacKey ?? (c as any).zerosslEabHmacKey;
      if (!kid || !hmac) {
        throw new ValidationError(
          'ZeroSSL as the default CA requires EAB Key ID and HMAC key from the ZeroSSL developer console'
        );
      }
    }

    const updated = await this.repository.updateAcmeSettings(c.id, {
      ...(acmeDefaultProvider && { acmeDefaultProvider }),
      ...(body.clearZerosslEab
        ? { zerosslEabKid: null, zerosslEabHmacKey: null }
        : {
            ...(body.zerosslEabKid !== undefined && {
              zerosslEabKid: body.zerosslEabKid?.trim() || null,
            }),
            ...(body.zerosslEabHmacKey !== undefined &&
              body.zerosslEabHmacKey !== '' &&
              body.zerosslEabHmacKey !== null && {
                zerosslEabHmacKey: body.zerosslEabHmacKey.trim(),
              }),
          }),
    });

    return this.toPublicConfig(updated);
  }
}
