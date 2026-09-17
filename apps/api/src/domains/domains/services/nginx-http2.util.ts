/**
 * nginx ≥ 1.25.1 deprecates `listen … http2` in favor of the `http2 on;` directive.
 * Host installs use 1.28; docker image may still be on 1.24.
 */

export type Http2ListenMode = 'directive' | 'listen';

/** Parse `nginx/1.28.0` (or similar) from `nginx -v` output. */
export function parseNginxVersion(versionOutput: string): { major: number; minor: number; patch: number } | null {
  const m = versionOutput.match(/nginx\/(\d+)\.(\d+)\.(\d+)/i);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** True when `http2 on;` is supported (and `listen … http2` is deprecated). */
export function prefersHttp2Directive(version: { major: number; minor: number; patch: number } | null): boolean {
  if (!version) return false;
  const { major, minor, patch } = version;
  if (major > 1) return true;
  if (major < 1) return false;
  if (minor > 25) return true;
  if (minor < 25) return false;
  return patch >= 1;
}

export function http2ListenModeFromNginxV(versionOutput: string): Http2ListenMode {
  return prefersHttp2Directive(parseNginxVersion(versionOutput)) ? 'directive' : 'listen';
}
