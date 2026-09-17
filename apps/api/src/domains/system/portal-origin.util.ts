/**
 * Normalize a portal / CORS origin to what browsers send in the Origin header.
 * - strips path, query, hash (https://proxy.boxo2.us/ → https://proxy.boxo2.us)
 * - keeps default ports omitted (same as URL.origin)
 */
export function normalizePortalOrigin(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

export function normalizePortalOrigins(rawOrigins: string[]): string[] {
  const out = new Set<string>();
  for (const o of rawOrigins) {
    const n = normalizePortalOrigin(o);
    if (n) out.add(n);
  }
  return [...out];
}
