import api from './api';
import { SystemConfig, ApiResponse } from '@/types';

export const systemConfigService = {
  /**
   * Get system configuration
   */
  getConfig: async (): Promise<ApiResponse<SystemConfig>> => {
    const response = await api.get('/system-config');
    return response.data;
  },

  /**
   * Update node mode (master or slave)
   */
  updateNodeMode: async (nodeMode: 'master' | 'slave'): Promise<ApiResponse<SystemConfig>> => {
    const response = await api.put('/system-config/node-mode', { nodeMode });
    return response.data;
  },

  updatePortalAccess: async (portalAccessOrigins: string[]): Promise<ApiResponse<SystemConfig>> => {
    const response = await api.put('/system-config/portal-access', { portalAccessOrigins });
    return response.data;
  },

  /**
   * VRRP / Keepalived virtual IP (HA). Master node only.
   */
  /**
   * Host network interface names (Linux /sys) — admin, for VRRP interface picker.
   */
  getNetworkInterfaces: async (): Promise<ApiResponse<{ interfaces: string[] }>> => {
    const response = await api.get('/system-config/network-interfaces');
    return response.data;
  },

  updateKeepalived: async (body: {
    keepalivedEnabled: boolean;
    keepalivedVirtualIp?: string | null;
    keepalivedVrrpInterface?: string | null;
    keepalivedRouterId?: number;
    keepalivedAuthPass?: string | null;
    keepalivedPriorityMaster?: number;
    keepalivedPriorityBackup?: number;
  }): Promise<ApiResponse<SystemConfig>> => {
    const response = await api.put('/system-config/keepalived', body);
    return response.data;
  },

  restartFrontend: async (): Promise<ApiResponse<{ ok: boolean }>> => {
    const response = await api.post('/system-config/restart-frontend');
    return response.data;
  },

  /** Schedules git pull + scripts/update.sh in a detached process (response returns immediately) */
  runSystemUpdate: async (): Promise<
    ApiResponse<{ output: string; scheduled: boolean; logFile: string }>
  > => {
    const response = await api.post('/system-config/system-update', {}, { timeout: 120_000 });
    return response.data;
  },

  /** Tail of /var/log/nginx-warden-ui-update.log (short timeout; safe to poll while backend restarts) */
  getSystemUpdateLog: async (): Promise<
    ApiResponse<{ content: string; path: string; exists: boolean; truncated: boolean }>
  > => {
    const response = await api.get('/system-config/system-update-log', { timeout: 15_000 });
    return response.data;
  },

  /**
   * Connect to master node (for slave mode)
   */
  connectToMaster: async (params: {
    masterHost: string;
    masterPort: number;
    masterApiKey: string;
    syncInterval?: number;
  }): Promise<ApiResponse<SystemConfig>> => {
    const response = await api.post('/system-config/connect-master', params);
    return response.data;
  },

  /**
   * Disconnect from master node
   */
  disconnectFromMaster: async (): Promise<ApiResponse<SystemConfig>> => {
    const response = await api.post('/system-config/disconnect-master', {});
    return response.data;
  },

  /**
   * Test connection to master
   */
  testMasterConnection: async (): Promise<ApiResponse<{
    latency: number;
    masterVersion: string;
    masterStatus: string;
  }>> => {
    const response = await api.post('/system-config/test-master-connection', {});
    return response.data;
  },

  /**
   * Sync configuration from master (slave pulls config)
   */
  syncWithMaster: async (): Promise<ApiResponse<{
    changesApplied: number;
    lastSyncAt: string;
  }>> => {
    const response = await api.post('/system-config/sync', {});
    return response.data;
  },
};
