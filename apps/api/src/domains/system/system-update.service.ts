import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import logger from '../../utils/logger';

const execFileAsync = promisify(execFile);

const MAX_OUTPUT_CHARS = 120_000;

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

function truncateOutput(s: string): string {
  if (s.length <= MAX_OUTPUT_CHARS) return s;
  return `…(truncated, showing last ${MAX_OUTPUT_CHARS} chars)\n${s.slice(-MAX_OUTPUT_CHARS)}`;
}

/**
 * git fetch / pull from GitHub (or configured remote), then run scripts/update.sh as root.
 * Requires: API process running as root (same as deploy), valid git repo optional, ENABLE_WEB_SYSTEM_UPDATE not false.
 */
export async function runGithubUpdateAndInstallScript(): Promise<{ output: string }> {
  const disabled = process.env.ENABLE_WEB_SYSTEM_UPDATE === 'false' || process.env.ENABLE_WEB_SYSTEM_UPDATE === '0';
  if (disabled) {
    throw new Error('Web-based system update is disabled. Set ENABLE_WEB_SYSTEM_UPDATE=true in the API .env.');
  }

  const root = resolveProjectRoot();
  const updateScript = path.join(root, 'scripts', 'update.sh');

  if (!fs.existsSync(updateScript) || !fs.statSync(updateScript).isFile()) {
    throw new Error(
      `Update script not found at ${updateScript}. Set NGINX_WARDEN_ROOT to your Nginx Warden install directory.`
    );
  }

  const branch = (process.env.UPDATE_GIT_BRANCH || 'main').trim();
  const remote = (process.env.UPDATE_GIT_REMOTE || 'origin').trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(branch) || !/^[a-zA-Z0-9_.-]+$/.test(remote)) {
    throw new Error('Invalid UPDATE_GIT_BRANCH or UPDATE_GIT_REMOTE');
  }

  let out = '';

  const gitDir = path.join(root, '.git');
  if (fs.existsSync(gitDir)) {
    try {
      const fetch = await execFileAsync('git', ['fetch', remote], {
        cwd: root,
        timeout: 300_000,
        maxBuffer: 20 * 1024 * 1024,
      });
      out += `--- git fetch ${remote} ---\n${fetch.stdout || ''}${fetch.stderr || ''}\n`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('git fetch failed', e);
      throw new Error(`git fetch failed: ${msg}`);
    }

    try {
      const co = await execFileAsync('git', ['checkout', branch], {
        cwd: root,
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      });
      out += `--- git checkout ${branch} ---\n${co.stdout || ''}${co.stderr || ''}\n`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      out += `--- git checkout ${branch} (warning) ---\n${msg}\n`;
    }

    try {
      const pull = await execFileAsync('git', ['pull', '--ff-only', remote, branch], {
        cwd: root,
        timeout: 300_000,
        maxBuffer: 20 * 1024 * 1024,
      });
      out += `--- git pull --ff-only ${remote} ${branch} ---\n${pull.stdout || ''}${pull.stderr || ''}\n`;
    } catch (e) {
      const err = e as { stderr?: string; message?: string };
      logger.error('git pull failed', e);
      throw new Error(
        `git pull failed (local changes or non-fast-forward?). ${err.stderr || err.message || String(e)}`
      );
    }
  } else {
    out += '--- git: no .git directory; skipping clone/pull. Run update.sh only.\n';
  }

  try {
    const run = await execFileAsync('bash', [updateScript], {
      cwd: root,
      timeout: 900_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    out += '\n--- scripts/update.sh ---\n';
    out += `${run.stdout || ''}${run.stderr || ''}`;
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    out += '\n--- scripts/update.sh (failed) ---\n';
    out += `${err.stdout || ''}${err.stderr || ''}`;
    logger.error('update.sh failed', e);
    throw new Error(
      `update.sh failed: ${err.stderr || err.message || String(e)}\n\n${truncateOutput(out)}`
    );
  }

  logger.info('System update from UI completed');
  return { output: truncateOutput(out) };
}
