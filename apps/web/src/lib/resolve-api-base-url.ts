/**
 * Resolves the backend API base URL (…/api).
 *
 * **Default (browser):** same hostname (or IPv6 literal) as the current page + `VITE_API_PORT` (default 3001).
 * This works for private IP, LAN, DNS, or public IP — even when an old build baked in a different
 * `VITE_API_URL` (e.g. public IP only).
 *
 * **Fixed API host:** set `VITE_API_USE_FIXED=true` at build time and `VITE_API_URL` to the real API
 * origin (e.g. separate subdomain or reverse-proxy URL).
 */
export function resolveApiBaseUrl(): string {
  const useFixed =
    import.meta.env.VITE_API_USE_FIXED === 'true' ||
    import.meta.env.VITE_API_USE_FIXED === '1';

  const env = import.meta.env.VITE_API_URL as string | undefined;
  const trimmed = typeof env === 'string' ? env.trim() : '';
  const apiPort = String(import.meta.env.VITE_API_PORT ?? '3001').trim() || '3001';

  if (typeof window !== 'undefined' && window.location?.href && !useFixed) {
    try {
      const u = new URL(window.location.href);
      u.port = apiPort;
      u.pathname = '/api';
      u.search = '';
      u.hash = '';
      return u.href.replace(/\/$/, '');
    } catch {
      /* fall through */
    }
  }

  if (trimmed && trimmed.toLowerCase() !== 'auto') {
    return normalizeApiBase(trimmed);
  }

  return `http://localhost:${apiPort}/api`;
}

function normalizeApiBase(url: string): string {
  const u = url.replace(/\/+$/, '');
  if (u.endsWith('/api')) {
    return u;
  }
  return `${u}/api`;
}
