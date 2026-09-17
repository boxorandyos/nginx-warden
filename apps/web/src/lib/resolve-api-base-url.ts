/**
 * Resolves the backend API base URL (…/api).
 *
 * **Default (browser):**
 * - Page on :80 / :443 (or default ports) → same-origin `/api` (reverse-proxy friendly).
 * - Page on any other port (e.g. :8088) → same hostname + `VITE_API_PORT` (default 3001).
 *
 * **Fixed API host:** set `VITE_API_USE_FIXED=true` at build time and `VITE_API_URL` to the real API
 * origin (e.g. separate subdomain).
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
      if (isReverseProxiedPage(u)) {
        // https://warden.example.com → https://warden.example.com/api
        // (nginx must proxy /api to the backend; see portal domain config)
        return `${u.protocol}//${u.host}/api`.replace(/\/$/, '');
      }
      // Direct UI access: http://10.0.0.5:8088 → http://10.0.0.5:3001/api
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

/** True when the page is served on default HTTP/HTTPS ports (typical reverse-proxy). */
export function isReverseProxiedPage(u: Pick<URL, 'protocol' | 'port'>): boolean {
  const port = u.port || '';
  if (u.protocol === 'https:') {
    return port === '' || port === '443';
  }
  if (u.protocol === 'http:') {
    return port === '' || port === '80';
  }
  return false;
}

function normalizeApiBase(url: string): string {
  const u = url.replace(/\/+$/, '');
  if (u.endsWith('/api')) {
    return u;
  }
  return `${u}/api`;
}
