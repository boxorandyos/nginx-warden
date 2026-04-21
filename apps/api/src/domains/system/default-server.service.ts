import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import logger from '../../utils/logger';
import { PATHS } from '../../shared/constants/paths.constants';
import { nginxReloadService } from '../domains/services/nginx-reload.service';

const execAsync = promisify(exec);

export const DEFAULT_SERVER_FILE = path.posix.join(PATHS.NGINX.SITES_AVAILABLE, 'default');
export const DEFAULT_INDEX_HTML = path.posix.join(PATHS.WEBROOT, 'index.html');

const BACKUP_SUFFIX = '.warden.bak';

/** Shipped default: matches install-nginx-modsecurity.sh (Edge → Default site in UI). */
export function getDefaultNginxTemplate(): string {
  return `# Nginx Warden — default catch-all HTTP server.
# Serves unmatched hostnames and bare IP access. Edit in the panel: Edge → Default site.

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/html;
    index index.html index.htm;

    # ACME HTTP-01 (Let's Encrypt / ZeroSSL webroot)
    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        allow all;
    }

    location = /.well-known/acme-challenge/ {
        return 404;
    }

    location / {
        try_files $uri $uri/ =404;
    }

    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        allow ::1;
        deny all;
    }
}
`;
}

export function getDefaultIndexHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nginx Warden · Default site</title>
  <style>
    :root {
      --bg0: #0a0f0d;
      --bg1: #121a16;
      --accent: #00c853;
      --accent-dim: #009639;
      --text: #e8f5e9;
      --muted: #81c78488;
      --card: #1b2420;
      --border: #2e3d36;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
      color: var(--text);
      background: radial-gradient(1200px 600px at 20% -10%, #143528 0%, transparent 55%),
                  radial-gradient(900px 500px at 100% 0%, #0d2818 0%, transparent 50%),
                  linear-gradient(165deg, var(--bg0), var(--bg1));
    }
    .wrap {
      max-width: 40rem;
      margin: 0 auto;
      padding: clamp(2rem, 6vw, 4rem) 1.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      border: 1px solid var(--border);
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: rgba(0, 200, 83, 0.06);
    }
    h1 {
      font-size: clamp(1.75rem, 4vw, 2.25rem);
      font-weight: 700;
      line-height: 1.15;
      margin: 1rem 0 0.75rem;
      background: linear-gradient(120deg, #fff, #a5d6a7);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    p.lead {
      font-size: 1.05rem;
      line-height: 1.6;
      color: #b2dfbc;
      margin: 0 0 1.5rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.35rem;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    }
    .card h2 {
      margin: 0 0 0.75rem;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--accent);
    }
    ul {
      margin: 0;
      padding-left: 1.1rem;
      color: #c8e6c9;
      line-height: 1.65;
      font-size: 0.95rem;
    }
    .foot {
      margin-top: 2rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .pulse {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 12px var(--accent);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge"><span class="pulse" aria-hidden="true"></span> Default server</div>
    <h1>You have reached the catch-all site</h1>
    <p class="lead">
      This page is shown when a request does not match any configured domain or virtual host
      — for example, connecting by IP address or before DNS is pointed correctly.
    </p>
    <div class="card">
      <h2>What to do next</h2>
      <ul>
        <li>Add or fix a <strong>domain</strong> in Nginx Warden so traffic routes to your app.</li>
        <li>Issue <strong>SSL</strong> certificates once DNS resolves to this host.</li>
        <li>Replace this page or add a <strong>redirect</strong> from the default server block in the panel.</li>
      </ul>
    </div>
    <p class="foot">Nginx Warden · ModSecurity-enabled edge</p>
  </div>
</body>
</html>
`;
}

async function readOrFallback(filePath: string, fallback: string): Promise<string> {
  try {
    const s = await fs.readFile(filePath, 'utf8');
    return s.trim().length ? s : fallback;
  } catch (e: any) {
    if (e?.code === 'ENOENT') {
      return fallback;
    }
    throw e;
  }
}

export interface DefaultServerPayload {
  nginxConfig: string;
  indexHtml: string;
  paths: { nginx: string; indexHtml: string };
}

export async function getDefaultServer(): Promise<DefaultServerPayload> {
  const nginxFallback = getDefaultNginxTemplate();
  const htmlFallback = getDefaultIndexHtmlTemplate();
  const nginxConfig = await readOrFallback(DEFAULT_SERVER_FILE, nginxFallback);
  const indexHtml = await readOrFallback(DEFAULT_INDEX_HTML, htmlFallback);
  return {
    nginxConfig,
    indexHtml,
    paths: { nginx: DEFAULT_SERVER_FILE, indexHtml: DEFAULT_INDEX_HTML },
  };
}

function validatePayload(nginxConfig: string, indexHtml: string): void {
  const n = nginxConfig.trim();
  if (!n) {
    throw new Error('Nginx configuration cannot be empty');
  }
  if (!/\bserver\s*\{/.test(n)) {
    throw new Error('Nginx configuration must contain a server { ... } block');
  }
  if (!/\blisten\b/.test(n)) {
    throw new Error('Nginx configuration should include at least one listen directive');
  }
  if (!indexHtml.trim()) {
    throw new Error('index.html body cannot be empty');
  }
}

async function backupIfExists(src: string): Promise<string | null> {
  const bak = src + BACKUP_SUFFIX;
  try {
    await fs.copyFile(src, bak);
    return bak;
  } catch (e: any) {
    if (e?.code === 'ENOENT') {
      return null;
    }
    throw e;
  }
}

async function restoreIfBackup(bak: string | null, dest: string): Promise<void> {
  if (!bak) return;
  try {
    await fs.copyFile(bak, dest);
  } catch (e) {
    logger.error(`Failed to restore ${dest} from backup`, e);
  }
}

async function removeQuiet(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch {
    // ignore
  }
}

export async function updateDefaultServer(nginxConfig: string, indexHtml: string): Promise<void> {
  validatePayload(nginxConfig, indexHtml);

  await fs.mkdir(PATHS.NGINX.SITES_AVAILABLE, { recursive: true });
  await fs.mkdir(PATHS.WEBROOT, { recursive: true });
  await fs.mkdir(path.posix.join(PATHS.WEBROOT, '.well-known', 'acme-challenge'), {
    recursive: true,
  });

  const nginxBak = await backupIfExists(DEFAULT_SERVER_FILE);
  const indexBak = await backupIfExists(DEFAULT_INDEX_HTML);

  try {
    await fs.writeFile(DEFAULT_SERVER_FILE, nginxConfig, { encoding: 'utf8', mode: 0o644 });
    await fs.writeFile(DEFAULT_INDEX_HTML, indexHtml, { encoding: 'utf8', mode: 0o644 });
    await execAsync('nginx -t 2>&1');
  } catch (err: any) {
    await restoreIfBackup(nginxBak, DEFAULT_SERVER_FILE);
    await restoreIfBackup(indexBak, DEFAULT_INDEX_HTML);
    const msg = err?.stderr || err?.message || String(err);
    throw new Error(`nginx configuration test failed: ${msg}`);
  }

  const reload = await nginxReloadService.reload();
  if (!reload.success) {
    await restoreIfBackup(nginxBak, DEFAULT_SERVER_FILE);
    await restoreIfBackup(indexBak, DEFAULT_INDEX_HTML);
    await nginxReloadService.reload().catch(() => {});
    throw new Error(reload.error || 'Nginx reload failed after updating default server');
  }

  if (nginxBak) await removeQuiet(nginxBak);
  if (indexBak) await removeQuiet(indexBak);
  logger.info('Default server configuration and index.html updated');
}
