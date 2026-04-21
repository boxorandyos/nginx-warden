import api from './api';
import { ApiResponse } from '@/types';

export type FirewallSetKind =
  | 'trusted_ipv4'
  | 'trusted_ipv6'
  | 'local_deny_ipv4'
  | 'local_deny_ipv6';

export type FirewallSettings = {
  id: string;
  enabled: boolean;
  sshPort: number;
  apiPort: number;
  uiPort: number;
  publicTcpPorts: number[];
  crowdsecNftSetV4: string;
  crowdsecNftSetV6: string;
  updatedAt: string;
};

export type FirewallEntry = {
  id: string;
  kind: FirewallSetKind;
  cidr: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FirewallApplyLog = {
  id: string;
  success: boolean;
  checksum: string | null;
  errorMessage: string | null;
  appliedAt: string;
};

export type FirewallState = {
  settings: FirewallSettings;
  entries: FirewallEntry[];
  applyLogs: FirewallApplyLog[];
};

export type CrowdsecStatus = {
  cscliOnPath: boolean;
  version?: string;
  bouncersList?: string;
  metricsSnippet?: string;
  lapi?: {
    url: string;
    ok: boolean;
    statusCode?: number;
    error?: string;
  };
  hint?: string;
};

export type NftRuntime = {
  available: boolean;
  output?: string;
  error?: string;
};

export type CrowdsecDecisionsPayload = {
  ok: boolean;
  decisions?: unknown;
  error?: string;
};

export const firewallService = {
  getState: async (): Promise<ApiResponse<FirewallState>> => {
    const response = await api.get('/firewall/state');
    return response.data;
  },

  updateSettings: async (body: Partial<FirewallSettings>): Promise<ApiResponse<FirewallSettings>> => {
    const response = await api.put('/firewall/settings', body);
    return response.data;
  },

  addEntry: async (payload: {
    kind: FirewallSetKind;
    cidr: string;
    label?: string;
  }): Promise<ApiResponse<FirewallEntry>> => {
    const response = await api.post('/firewall/entries', payload);
    return response.data;
  },

  deleteEntry: async (id: string): Promise<ApiResponse<{ ok: boolean }>> => {
    const response = await api.delete(`/firewall/entries/${id}`);
    return response.data;
  },

  preview: async (): Promise<ApiResponse<{ content: string; checksum: string }>> => {
    const response = await api.get('/firewall/preview');
    return response.data;
  },

  apply: async (confirmLockoutRisk?: boolean): Promise<
    ApiResponse<{ success: boolean; checksum: string | null; message: string; error?: string }>
  > => {
    const response = await api.post('/firewall/apply', { confirmLockoutRisk: !!confirmLockoutRisk });
    return response.data;
  },

  getCrowdsecStatus: async (): Promise<ApiResponse<CrowdsecStatus>> => {
    const response = await api.get('/firewall/crowdsec-status');
    return response.data;
  },

  getNftRuntime: async (): Promise<ApiResponse<NftRuntime>> => {
    const response = await api.get('/firewall/nft-runtime');
    return response.data;
  },

  getCrowdsecDecisions: async (): Promise<ApiResponse<CrowdsecDecisionsPayload>> => {
    const response = await api.get('/firewall/crowdsec-decisions');
    return response.data;
  },
};
