export interface CustomLocationInput {
  path?: string;
  useUpstream?: boolean;
  upstreamType?: 'proxy_pass' | 'grpc_pass' | 'grpcs_pass' | string;
  upstreams?: Array<{ host?: string; port?: number }>;
  config?: string;
}

export interface CustomLocationValidationResult {
  valid: boolean;
  errors: string[];
  normalized: NormalizedCustomLocation[];
}

export interface NormalizedCustomLocation {
  path: string;
  useUpstream: boolean;
  upstreamType: 'proxy_pass' | 'grpc_pass' | 'grpcs_pass';
  upstreams: Array<{ host: string; port: number }>;
  config?: string;
}

/**
 * Normalize a location path: ensure leading slash, strip trailing slash (except "/").
 */
export function normalizeLocationPath(raw: string): string {
  let path = (raw || '').trim();
  if (!path) return '';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  // Collapse duplicate slashes
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

export function isLocationPathPrefixOf(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === '/') return true;
  return b.startsWith(`${a}/`);
}

/**
 * Validate custom location mappings for a domain.
 * Rejects empty/invalid paths, the catch-all "/", duplicate paths, and
 * locations that have neither a backend nor custom nginx config.
 */
export function validateCustomLocations(
  locations: CustomLocationInput[] | undefined | null
): CustomLocationValidationResult {
  const errors: string[] = [];
  const normalized: NormalizedCustomLocation[] = [];

  if (!locations || locations.length === 0) {
    return { valid: true, errors: [], normalized: [] };
  }

  const seen = new Map<string, number>();

  locations.forEach((loc, index) => {
    const label = `Location ${index + 1}`;
    const path = normalizeLocationPath(loc.path || '');

    if (!path) {
      errors.push(`${label}: path is required (e.g. /api or /blog)`);
      return;
    }

    if (path === '/') {
      errors.push(
        `${label}: path "/" is reserved for the domain's default backend. Use a subdirectory such as /api.`
      );
      return;
    }

    if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*$/.test(path)) {
      errors.push(`${label}: path "${path}" contains invalid characters`);
      return;
    }

    if (seen.has(path)) {
      errors.push(
        `${label}: path "${path}" duplicates location ${seen.get(path)}`
      );
      return;
    }
    seen.set(path, index + 1);

    const useUpstream = loc.useUpstream !== false && Boolean(
      loc.upstreams && loc.upstreams.some((u) => u.host && String(u.host).trim())
    );

    const validUpstreams = (loc.upstreams || [])
      .filter((u) => u.host && String(u.host).trim())
      .map((u) => ({
        host: String(u.host).trim(),
        port: Number(u.port) || 80,
      }));

    const hasConfig = Boolean(loc.config && loc.config.trim());

    if (loc.useUpstream === true && validUpstreams.length === 0) {
      errors.push(`${label} (${path}): enable upstream requires at least one backend host`);
      return;
    }

    if (!useUpstream && !hasConfig && validUpstreams.length === 0) {
      errors.push(
        `${label} (${path}): provide backend servers or custom nginx configuration`
      );
      return;
    }

    const upstreamType =
      loc.upstreamType === 'grpc_pass' || loc.upstreamType === 'grpcs_pass'
        ? loc.upstreamType
        : 'proxy_pass';

    normalized.push({
      path,
      useUpstream: useUpstream || validUpstreams.length > 0,
      upstreamType,
      upstreams: validUpstreams,
      config: loc.config,
    });
  });

  // Prefix overlaps are valid in nginx (longest match wins) — only warn via ordering.
  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

/**
 * Longest prefix first so nginx config is readable and ^~ matches as intended.
 */
export function sortLocationsLongestFirst<T extends { path: string }>(locations: T[]): T[] {
  return [...locations].sort((a, b) => b.path.length - a.path.length);
}

/**
 * nginx location matcher. Prefix paths use ^~ so they win over regex locations.
 */
export function nginxLocationMatch(path: string): string {
  const trimmed = (path || '').trim();
  if (trimmed.startsWith('~') || trimmed.startsWith('=')) {
    return trimmed;
  }
  const normalized = normalizeLocationPath(trimmed);
  return `^~ ${normalized}`;
}
