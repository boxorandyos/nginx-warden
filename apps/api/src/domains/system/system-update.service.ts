import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import logger from '../../utils/logger';

/** Same path as scripts/update.sh (LOG_FILE) — shown in API response */
export const NGINX_WARDEN_UI_UPDATE_LOG = '/var/log/nginx-warden-ui-update.log';

export type SystemUpdateResult = {
  output: string;
  scheduled: boolean;
  logFile: string;
};

/**
 * Resolve monorepo root (parent of apps/api). Override with NGINX_WARDEN_ROOT on the API host.
 */
export function resolveProjectRoot(): string {
  const env = process.env.NGINX_WARDEN_ROOT || process.env.NGINX_WARDEN_HOME;
  if (env && env.trim()) {
    return path.resolve(env.trim());
  }
  return path.resolve(process.cwd(), '..', '..');
}

/**
 * Schedule git pull + scripts/update.sh in a detached process.
 *
 * The UI must not run update.sh synchronously: update.sh calls `systemctl stop nginx-warden-backend`,
 * which would stop the same Node process that is waiting on the shell child — deadlock and stop timeout.
 */
export async function runGithubUpdateAndInstallScript(): Promise<SystemUpdateResult> {
  const disabled = process.env.ENABLE_WEB_SYSTEM_UPDATE === 'false' || process.env.ENABLE_WEB_SYSTEM_UPDATE === '0';
  if (disabled) {
    throw new Error('Web-based system update is disabled. Set ENABLE_WEB_SYSTEM_UPDATE=true in the API .env.');
  }

  const root = resolveProjectRoot();
  const wrapperScript = path.join(root, 'scripts', 'apply-update-from-remote.sh');
  const updateScript = path.join(root, 'scripts', 'update.sh');

  if (!fs.existsSync(updateScript) || !fs.statSync(updateScript).isFile()) {
    throw new Error(
      `Update script not found at ${updateScript}. Set NGINX_WARDEN_ROOT to your Nginx Warden install directory.`
    );
  }

  if (!fs.existsSync(wrapperScript) || !fs.statSync(wrapperScript).isFile()) {
    throw new Error(
      `apply-update-from-remote.sh not found at ${wrapperScript}. Ensure the repo is complete.`
    );
  }

  const branch = (process.env.UPDATE_GIT_BRANCH || 'main').trim();
  const remote = (process.env.UPDATE_GIT_REMOTE || 'origin').trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(branch) || !/^[a-zA-Z0-9_.-]+$/.test(remote)) {
    throw new Error('Invalid UPDATE_GIT_BRANCH or UPDATE_GIT_REMOTE');
  }

  const child = spawn('bash', [wrapperScript], {
    detached: true,
    stdio: 'ignore',
    cwd: root,
    env: process.env,
  });

  child.on('error', (err: Error) => {
    logger.error('Failed to spawn apply-update-from-remote.sh', err);
  });

  child.unref();

  if (child.pid === undefined) {
    throw new Error('Could not start background update process');
  }

  const output = [
    'Update scheduled in the background (detached from the API process).',
    `Progress is written to: ${NGINX_WARDEN_UI_UPDATE_LOG}`,
    'On the server: sudo tail -f ' + NGINX_WARDEN_UI_UPDATE_LOG,
    'Services will stop and restart during the run; refresh the portal after a few minutes.',
  ].join('\n');

  logger.info('System update scheduled in background', { pid: child.pid, root });

  return {
    output,
    scheduled: true,
    logFile: NGINX_WARDEN_UI_UPDATE_LOG,
  };
}
