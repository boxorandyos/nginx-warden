import { Request } from 'express';

/**
 * Slave Node Status
 */
export type SlaveNodeStatus = 'online' | 'offline' | 'syncing' | 'error';

/**
 * Slave Node Interface
 */
export interface SlaveNode {
  id: string;
  name: string;
  host: string;
  port: number;
  apiKey: string;
  status: SlaveNodeStatus;
  syncEnabled: boolean;
  syncInterval: number;
  lastSeen: Date | null;
  configHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Slave Node Response (without sensitive data)
 */
export interface SlaveNodeResponse {
  id: string;
  name: string;
  host: string;
  port: number;
  status: SlaveNodeStatus;
  syncEnabled: boolean;
  syncInterval: number;
  lastSeen: Date | null;
  configHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Slave Node Creation Response (includes API key ONCE)
 */
export interface SlaveNodeCreationResponse {
  id: string;
  name: string;
  host: string;
  port: number;
  apiKey: string;
  status: SlaveNodeStatus;
}

/**
 * Extended Request with Slave Node Info
 */
export interface SlaveRequest extends Request {
  slaveNode?: {
    id: string;
    name: string;
    host: string;
    port: number;
  };
}

/**
 * Sync Configuration Data
 */
export interface SyncKeepalived {
  enabled: boolean;
  virtualIp: string | null;
  vrrpInterface: string | null;
  routerId: number;
  authPass: string | null;
  priorityMaster: number;
  priorityBackup: number;
}

export interface SyncConfigData {
  domains: SyncDomain[];
  sslCertificates: SyncSSLCertificate[];
  modsecCRSRules: SyncModSecCRSRule[];
  modsecCustomRules: SyncModSecCustomRule[];
  aclRules: SyncACLRule[];
  users: SyncUser[];
  networkLoadBalancers: SyncNetworkLoadBalancer[];
  /** Omitted in exports from older masters — import ignores if absent. */
  keepalived?: SyncKeepalived;
  /** Omitted in exports from older masters — import ignores if absent. */
  authProviders?: SyncAuthProvider[];
  authPolicies?: SyncAuthPolicy[];
  authAbuseSettings?: SyncAuthAbuseSettings | null;
}

/**
 * Sync Domain
 */
export interface SyncDomain {
  name: string;
  status: string;
  sslEnabled: boolean;
  modsecEnabled: boolean;
  realIpEnabled?: boolean;
  realIpCloudflare?: boolean;
  realIpCustomCidrs?: string[];
  hstsEnabled?: boolean;
  http2Enabled?: boolean;
  grpcEnabled?: boolean;
  clientMaxBodySize?: number | null;
  customLocations?: unknown;
  limitReqPerMinute?: number;
  limitReqBurst?: number;
  limitConnPerAddr?: number;
  modsecEngineMode?: string;
  crowdsecNginxEnabled?: boolean;
  crowdsecAppsecEnabled?: boolean;
  sslExpiry?: string | null;
  upstreams: SyncUpstream[];
  loadBalancer: SyncLoadBalancer | null;
}

/**
 * Sync Upstream
 */
export interface SyncUpstream {
  host: string;
  port: number;
  protocol: string;
  sslVerify: boolean;
  weight: number;
  maxFails: number;
  failTimeout: number;
}

/**
 * Sync Load Balancer
 */
export interface SyncLoadBalancer {
  algorithm: string;
  healthCheckEnabled: boolean;
  healthCheckPath: string | null;
  healthCheckInterval: number;
  healthCheckTimeout: number;
}

/**
 * Sync SSL Certificate
 */
export interface SyncSSLCertificate {
  domainName: string | null | undefined;
  commonName: string;
  sans: string[];
  issuer: string;
  certificate: string;
  privateKey: string;
  chain: string | null;
  autoRenew: boolean;
  acmeProvider?: string | null;
  validFrom: string;
  validTo: string;
}

/**
 * Sync ModSecurity CRS Rule
 */
export interface SyncModSecCRSRule {
  ruleFile: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  paranoia: number;
}

/**
 * Sync ModSecurity Custom Rule
 */
export interface SyncModSecCustomRule {
  name: string;
  category: string;
  ruleContent: string;
  description: string | null;
  enabled: boolean;
}

/**
 * Sync ACL Rule
 */
export interface SyncACLRule {
  name: string;
  type: string;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  action: string;
  enabled: boolean;
}

/**
 * Sync User
 */
export interface SyncUser {
  email: string;
  username: string;
  fullName: string;
  password: string | null; // Already hashed; null for external IdP users
  role: string;
  status?: string;
  /** How this user authenticates — omitted by older masters (treat as local) */
  authProvider?: string;
  externalId?: string | null;
  externalGroups?: string[];
}

/**
 * Sync Auth Provider (LDAP/OIDC/Local config including secrets needed on slaves)
 */
export interface SyncAuthProvider {
  type: string;
  name: string;
  enabled: boolean;
  isSystem: boolean;
  priority: number;
  config: Record<string, unknown>;
}

/**
 * Sync Auth Policy — gateway policies use domainName (not local domain IDs)
 */
export interface SyncAuthPolicy {
  name: string;
  /** Stable for admin_portal; for gateway policies this is recomputed on import */
  slug: string;
  target: string;
  /** Domain hostname when target = access_gateway */
  domainName?: string | null;
  enabled: boolean;
  requireMfa: boolean;
  groupAllow: string[];
  groupDeny: string[];
  sessionTtlMinutes?: number | null;
  description?: string | null;
  /** Providers linked by type+name (stable across nodes) */
  providers: Array<{ type: string; name: string }>;
}

/**
 * Sync Auth Abuse Settings (thresholds only — not live lock state)
 */
export interface SyncAuthAbuseSettings {
  maxFailuresPerUser: number;
  userLockMinutes: number;
  maxFailuresPerIp: number;
  ipBanEnabled: boolean;
  ipFirewallBanAfter: number;
  maxFailuresBeforeAuthDisable: number;
  authCircuitMinutes: number;
  windowMinutes: number;
  /** Circuit open-until is node-local runtime; omit from sync hash stability if null */
  authDisabledUntil?: string | null;
}

/**
 * Sync Network Load Balancer
 */
export interface SyncNetworkLoadBalancer {
  name: string;
  description?: string;
  port: number;
  protocol: string;
  algorithm: string;
  enabled: boolean;
  proxyTimeout: number;
  proxyConnectTimeout: number;
  proxyNextUpstream: boolean;
  proxyNextUpstreamTimeout: number;
  proxyNextUpstreamTries: number;
  healthCheckEnabled: boolean;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  healthCheckRises: number;
  healthCheckFalls: number;
  upstreams: SyncNLBUpstream[];
}

/**
 * Sync NLB Upstream
 */
export interface SyncNLBUpstream {
  host: string;
  port: number;
  weight: number;
  maxFails: number;
  failTimeout: number;
  maxConns: number;
  backup: boolean;
  down: boolean;
}

/**
 * Sync Export Response
 */
export interface SyncExportResponse {
  hash: string;
  config: SyncConfigData;
}

/**
 * Import Results
 */
export interface ImportResults {
  domains: number;
  upstreams: number;
  loadBalancers: number;
  ssl: number;
  modsecCRS: number;
  modsecCustom: number;
  acl: number;
  users: number;
  networkLoadBalancers: number;
  nlbUpstreams: number;
  keepalived: number;
  authProviders: number;
  authPolicies: number;
  authAbuseSettings: number;
  totalChanges: number;
}

/**
 * Health Check Data
 */
export interface HealthCheckData {
  timestamp: string;
  nodeId: string | undefined;
  nodeName: string | undefined;
}

/**
 * Config Hash Response
 */
export interface ConfigHashResponse {
  hash: string;
}
