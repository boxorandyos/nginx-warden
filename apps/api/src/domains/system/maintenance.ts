import crypto from 'crypto';

export const PACKAGE_ALLOWLIST = [
  'nginx',
  'nginx-common',
  'keepalived',
  'crowdsec',
  'ca-certificates',
  'openssl',
] as const;

export type MaintenanceKind = 'product' | 'packages';

export interface SlaveUpgradeTarget {
  id: string;
  name: string;
  host: string;
  port: number;
  apiKey: string;
  syncEnabled: boolean;
}

export interface SlaveUpgradeCall {
  id: string;
  name: string;
  url: string;
  headers: Record<string, string>;
  body: { kind: MaintenanceKind };
}

export function parseMaintenanceKind(value: unknown): MaintenanceKind {
  if (value === 'product' || value === 'packages') return value;
  throw new Error('kind must be product or packages');
}

export function maintenanceKeyMatches(expected: string | null | undefined, presented: string | undefined): boolean {
  if (!expected || !presented) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(presented);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function slaveMaintenanceUrl(host: string, port: number): string {
  const trimmed = host.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(trimmed)) {
    throw new Error(`Refusing slave host ${host}`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Slave port is invalid');
  }
  return `http://${trimmed}:${port}/api/slave/maintenance`;
}

export function planSlaveUpgrades(nodes: SlaveUpgradeTarget[], kind: MaintenanceKind): SlaveUpgradeCall[] {
  return nodes
    .filter((node) => node.syncEnabled)
    .map((node) => ({
      id: node.id,
      name: node.name,
      url: slaveMaintenanceUrl(node.host, node.port),
      headers: { 'X-API-Key': node.apiKey, 'Content-Type': 'application/json' },
      body: { kind },
    }));
}
