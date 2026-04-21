import { BackupSchedule, BackupFile } from '@prisma/client';

/**
 * Backup Schedule with related backup files
 */
export interface BackupScheduleWithFiles extends BackupSchedule {
  backups: BackupFile[];
}

/**
 * Formatted backup schedule response
 */
export interface FormattedBackupSchedule {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: string;
  size?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Backup file with schedule information
 */
export interface BackupFileWithSchedule extends BackupFile {
  schedule: BackupSchedule | null;
}

/**
 * Formatted backup file response
 */
export interface FormattedBackupFile extends Omit<BackupFile, 'size'> {
  size: string;
  schedule?: BackupSchedule;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  domainsCount: number;
  sslCount: number;
  modsecRulesCount: number;
  aclRulesCount: number;
}

/**
 * Backup data structure
 */
/** Firewall snapshot (host nftables policy + address sets). */
export interface FirewallBackupData {
  settings: Record<string, unknown> | null;
  addressEntries: Array<{
    kind: string;
    cidr: string;
    label?: string | null;
  }>;
}

/** Access list + auth users + domain assignments (by domain name). */
export interface AccessListBackupData {
  name: string;
  description?: string | null;
  type: string;
  enabled: boolean;
  allowedIps: string[];
  authUsers: Array<{
    username: string;
    passwordHash: string;
    description?: string | null;
  }>;
  domainLinks: Array<{
    domainName: string;
    enabled: boolean;
  }>;
}

export interface BackupData {
  version: string;
  timestamp: string;
  domains: DomainBackupData[];
  ssl: SSLBackupData[];
  modsec: ModSecBackupData;
  acl: ACLBackupData[];
  notificationChannels: any[];
  alertRules: any[];
  users: any[];
  nginxConfigs: any[];
  networkLoadBalancers: NetworkLoadBalancerBackupData[];
  /** Host firewall (Phase 1). Omitted in older backups. */
  firewall?: FirewallBackupData;
  /** IP / basic-auth access lists. Omitted in older backups. */
  accessLists?: AccessListBackupData[];
}

/**
 * Domain backup data (includes DB id for ModSecurity domainId remapping on restore).
 */
export interface DomainBackupData {
  /** Original domain row id — used to remap ModSecurity rules to the new id after restore. */
  id?: string;
  name: string;
  status: string;
  sslEnabled: boolean;
  sslExpiry?: string | null;
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
  upstreams: any[];
  loadBalancer?: any;
  vhostConfig?: string;
  vhostEnabled?: boolean;
}

/**
 * SSL certificate backup data
 */
export interface SSLBackupData {
  domainName: string;
  commonName: string;
  sans: string[];
  issuer: string;
  autoRenew: boolean;
  validFrom: Date;
  validTo: Date;
  files?: {
    certificate?: string;
    privateKey?: string;
    chain?: string;
  };
}

/**
 * ModSecurity backup data
 */
export interface ModSecBackupData {
  globalSettings: any[];
  crsRules: any[];
  customRules: any[];
}

/**
 * ACL backup data
 */
export interface ACLBackupData {
  name: string;
  type: string;
  condition: {
    field: string;
    operator: string;
    value: string;
  };
  action: string;
  enabled: boolean;
}

/**
 * Import results
 */
export interface ImportResults {
  domains: number;
  vhostConfigs: number;
  upstreams: number;
  loadBalancers: number;
  ssl: number;
  sslFiles: number;
  modsecCRS: number;
  modsecCustom: number;
  acl: number;
  alertChannels: number;
  alertRules: number;
  users: number;
  nginxConfigs: number;
  networkLoadBalancers: number;
  nlbUpstreams: number;
  firewallSettings: number;
  firewallAddressEntries: number;
  accessLists: number;
}

/**
 * SSL certificate files
 */
export interface SSLCertificateFiles {
  certificate?: string;
  privateKey?: string;
  chain?: string;
}

/**
 * Network Load Balancer backup data
 */
export interface NetworkLoadBalancerBackupData {
  name: string;
  description?: string;
  port: number;
  protocol: string;
  algorithm: string;
  status: string;
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
  upstreams: NetworkLoadBalancerUpstreamBackupData[];
}

/**
 * Network Load Balancer upstream backup data
 */
export interface NetworkLoadBalancerUpstreamBackupData {
  host: string;
  port: number;
  weight: number;
  maxFails: number;
  failTimeout: number;
  maxConns: number;
  backup: boolean;
  down: boolean;
  status: string;
}

/**
 * Backup constants
 */
export const BACKUP_CONSTANTS = {
  BACKUP_DIR: process.env.BACKUP_DIR || '/var/backups/nginx-warden',
  NGINX_SITES_AVAILABLE: '/etc/nginx/sites-available',
  NGINX_SITES_ENABLED: '/etc/nginx/sites-enabled',
  SSL_CERTS_PATH: '/etc/nginx/ssl',
  BACKUP_VERSION: '2.1',
} as const;

/**
 * Backup status types
 */
export type BackupStatus = 'pending' | 'running' | 'success' | 'failed';

/**
 * Backup type
 */
export type BackupType = 'manual' | 'scheduled';
