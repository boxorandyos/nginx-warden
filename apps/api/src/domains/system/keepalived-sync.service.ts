import { writeFile, mkdir } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname } from 'node:path';
import prisma from '../../config/database';
import logger from '../../utils/logger';

const execAsync = promisify(exec);

const DEFAULT_CONF_PATH = '/etc/keepalived/keepalived.conf';

/**
 * Renders a minimal Keepalived VRRP config. Warden "master" node uses VRRP MASTER; slave uses BACKUP.
 * Ensure `apt install keepalived` (or package manager) on the host. API must run with permission to
 * write the config file and run `systemctl`.
 */
export function renderKeepalivedConf(params: {
  interface: string;
  virtualRouterId: number;
  virtualIp: string;
  authPass: string;
  priority: number;
  isWardenMaster: boolean;
}): string {
  const { interface: iface, virtualRouterId, virtualIp, authPass, priority, isWardenMaster } =
    params;
  const state = isWardenMaster ? 'MASTER' : 'BACKUP';
  // Keepalived v1 vrrp: auth string max 8 bytes for simple PASS
  const pass = authPass.length > 8 ? authPass.slice(0, 8) : authPass;

  return `#
# Nginx Warden — Keepalived (managed). Do not hand-edit; use the admin UI (master) or node sync.
#
global_defs {
  router_id warden${virtualRouterId}
  script_user root
  enable_script_security
}

vrrp_instance VI_WARDEN {
  state ${state}
  interface ${iface}
  virtual_router_id ${virtualRouterId}
  priority ${priority}
  advert_int 1
  authentication {
    auth_type PASS
    auth_pass ${pass}
  }
  virtual_ipaddress {
    ${virtualIp}
  }
}
`;
}

export type KeepalivedApplyResult = { ok: boolean; message?: string; skipped?: boolean };

/**
 * Writes ${KEEPALIVED_CONF_PATH} and (re)starts keepalived. If disabled, stops the unit (best effort).
 * Interface: env WARDEN_KEEPALIVED_INTERFACE overrides DB (for slaves with a different nic name).
 */
export async function applyKeepalivedFromDatabase(): Promise<KeepalivedApplyResult> {
  try {
    const sc = await prisma.systemConfig.findFirst();
    if (!sc) {
      return { ok: true, skipped: true, message: 'No system config' };
    }

    const confPath = process.env.KEEPALIVED_CONF_PATH || DEFAULT_CONF_PATH;
    const iface =
      (process.env.WARDEN_KEEPALIVED_INTERFACE || '').trim() ||
      (sc.keepalivedVrrpInterface || '').trim();

    if (!sc.keepalivedEnabled) {
      const minimal = `# Nginx Warden — Keepalived disabled\nglobal_defs { router_id warden_off }\n`;
      try {
        await mkdir(dirname(confPath), { recursive: true });
        await writeFile(confPath, minimal, { mode: 0o644 });
        await execAsync('systemctl stop keepalived 2>/dev/null || true', {
          timeout: 30_000,
          maxBuffer: 256 * 1024,
        });
      } catch (e) {
        logger.warn('[KEEPALIVED] stop/disable best-effort failed', e);
      }
      return { ok: true, message: 'Keepalived disabled' };
    }

    if (!iface || !sc.keepalivedVirtualIp?.trim()) {
      return {
        ok: false,
        message: 'keepalivedEnabled is true but vrrp interface or virtual IP is missing',
      };
    }

    const pass = (sc.keepalivedAuthPass || 'warden01').trim();
    if (pass.length < 1) {
      return { ok: false, message: 'VRRP auth pass is empty' };
    }

    const rid = sc.keepalivedRouterId;
    if (rid < 1 || rid > 255) {
      return { ok: false, message: 'VRRP router id must be 1–255' };
    }

    const isWardenMaster = sc.nodeMode === 'master';
    const priority = isWardenMaster ? sc.keepalivedPriorityMaster : sc.keepalivedPriorityBackup;

    const content = renderKeepalivedConf({
      interface: iface,
      virtualRouterId: rid,
      virtualIp: sc.keepalivedVirtualIp.trim(),
      authPass: pass,
      priority,
      isWardenMaster,
    });

    await mkdir(dirname(confPath), { recursive: true });
    await writeFile(confPath, content, { mode: 0o644 });

    await execAsync('systemctl enable keepalived 2>/dev/null || true; systemctl restart keepalived', {
      timeout: 60_000,
      maxBuffer: 256 * 1024,
    });

    logger.info('[KEEPALIVED] configuration applied', {
      path: confPath,
      mode: sc.nodeMode,
      iface,
    });
    return { ok: true, message: 'Keepalived applied' };
  } catch (e) {
    const err = e as Error;
    logger.error('[KEEPALIVED] apply failed', err);
    return { ok: false, message: err.message || 'apply failed' };
  }
}
