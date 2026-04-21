import fs from 'node:fs';
import path from 'node:path';
import prisma from '../../config/database';
import { config } from '../../config';
import logger from '../../utils/logger';

let cachedPortalOrigins: string[] = [];

export function getMergedCorsOrigins(): string[] {
  return [...new Set([...config.cors.origin, ...cachedPortalOrigins])];
}

export function setPortalAccessOriginsCache(origins: string[]): void {
  cachedPortalOrigins = [...origins];
}

export function hostsFromOrigins(origins: string[]): string[] {
  const hosts = new Set<string>();
  for (const o of origins) {
    try {
      const u = new URL(o);
      hosts.add(u.hostname);
    } catch {
      /* skip invalid */
    }
  }
  return [...hosts];
}

function resolveHostsFilePath(): string {
  const fromEnv = process.env.PORTAL_ALLOWED_HOSTS_FILE;
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), '..', 'web', 'portal-allowed-hosts.json');
}

/**
 * Write hostnames (from portal origins) for Vite dev/preview `allowedHosts`.
 * Frontend service must be restarted after a successful write for Vite to reload config.
 */
export function writePortalHostsFile(origins: string[]): void {
  const hosts = hostsFromOrigins(origins);
  const filePath = resolveHostsFilePath();
  const payload = { hosts, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  logger.info(`Portal allowed hosts file written: ${filePath} (${hosts.length} host(s))`);
}

export async function loadPortalCorsFromDatabase(): Promise<void> {
  const row = await prisma.systemConfig.findFirst();
  setPortalAccessOriginsCache(row?.portalAccessOrigins ?? []);
}
