import api from './api';
import type { ApiResponse } from '@/types';

export type AuthProviderType = 'local' | 'ldap' | 'oidc_entra' | 'oidc_generic';
export type AuthRequirementTarget = 'admin_portal' | 'access_gateway';
export type AuthAuditLevel = 'debug' | 'info' | 'warn' | 'error';
export type AuthAuditOutcome =
  | 'success'
  | 'failure'
  | 'lockout'
  | 'blocked'
  | 'challenge'
  | 'info';

export interface AuthProviderConfig {
  id: string;
  type: AuthProviderType;
  name: string;
  enabled: boolean;
  isSystem: boolean;
  config: Record<string, unknown>;
  priority: number;
  updatedAt: string;
}

export interface AuthPolicy {
  id: string;
  name: string;
  slug: string;
  target: AuthRequirementTarget;
  domainId: string | null;
  enabled: boolean;
  requireMfa: boolean;
  groupAllow: string[];
  groupDeny: string[];
  sessionTtlMinutes: number | null;
  description: string | null;
  providers: Array<{
    id: string;
    providerId: string;
    provider: AuthProviderConfig;
  }>;
}

export interface AuthAuditLog {
  id: string;
  level: AuthAuditLevel;
  outcome: AuthAuditOutcome;
  providerType: AuthProviderType | null;
  username: string | null;
  ip: string;
  message: string;
  createdAt: string;
}

export interface AuthAbuseSettings {
  id: string;
  maxFailuresPerUser: number;
  userLockMinutes: number;
  maxFailuresPerIp: number;
  ipBanEnabled: boolean;
  ipFirewallBanAfter: number;
  maxFailuresBeforeAuthDisable: number;
  authCircuitMinutes: number;
  authDisabledUntil: string | null;
  windowMinutes: number;
}

export interface AuthAbuseState {
  id: string;
  key: string;
  kind: string;
  failureCount: number;
  lockedUntil: string | null;
  permanentlyBlocked: boolean;
  lastFailureAt: string | null;
}

export const identityService = {
  listProviders: async (): Promise<ApiResponse<AuthProviderConfig[]>> => {
    const res = await api.get('/identity/providers');
    return res.data;
  },
  updateProvider: async (
    id: string,
    body: Partial<Pick<AuthProviderConfig, 'enabled' | 'name' | 'priority' | 'config'>>
  ): Promise<ApiResponse<AuthProviderConfig>> => {
    const res = await api.patch(`/identity/providers/${id}`, body);
    return res.data;
  },
  listPolicies: async (): Promise<ApiResponse<AuthPolicy[]>> => {
    const res = await api.get('/identity/policies');
    return res.data;
  },
  updatePolicy: async (
    id: string,
    body: {
      name?: string;
      enabled?: boolean;
      requireMfa?: boolean;
      groupAllow?: string[];
      groupDeny?: string[];
      providerIds?: string[];
      description?: string | null;
    }
  ): Promise<ApiResponse<AuthPolicy>> => {
    const res = await api.patch(`/identity/policies/${id}`, body);
    return res.data;
  },
  listAuditLogs: async (params?: {
    page?: number;
    outcome?: string;
    username?: string;
    ip?: string;
  }): Promise<
    ApiResponse<{ items: AuthAuditLog[]; total: number; page: number; pages: number }>
  > => {
    const res = await api.get('/identity/audit-logs', { params });
    return res.data;
  },
  getAbuseSettings: async (): Promise<ApiResponse<AuthAbuseSettings>> => {
    const res = await api.get('/identity/abuse/settings');
    return res.data;
  },
  updateAbuseSettings: async (
    body: Partial<AuthAbuseSettings>
  ): Promise<ApiResponse<AuthAbuseSettings>> => {
    const res = await api.put('/identity/abuse/settings', body);
    return res.data;
  },
  listAbuseStates: async (): Promise<ApiResponse<AuthAbuseState[]>> => {
    const res = await api.get('/identity/abuse/states');
    return res.data;
  },
  clearAbuseState: async (key: string): Promise<ApiResponse<{ ok: boolean }>> => {
    const res = await api.delete(`/identity/abuse/states/${encodeURIComponent(key)}`);
    return res.data;
  },
};
