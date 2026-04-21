import { readdir } from 'node:fs/promises';
import logger from '../../utils/logger';

const SYS_CLASS_NET = '/sys/class/net';

/**
 * List physical/virtual interface names from the Linux kernel (host-only).
 * Excludes `lo` (loopback is not used for VRRP). Fails soft on non-Linux or missing /sys.
 */
export async function listHostNetworkInterfaceNames(): Promise<string[]> {
  try {
    const names = await readdir(SYS_CLASS_NET);
    const out: string[] = [];
    for (const n of names) {
      if (n === '.' || n === '..' || n === 'lo') {
        continue;
      }
      // Only include entries that look like iface dirs (avoids rare oddities)
      if (!/^[a-zA-Z0-9._@:-]+$/.test(n)) {
        continue;
      }
      out.push(n);
    }
    return out.sort((a, b) => a.localeCompare(b));
  } catch (e) {
    logger.warn('[network-interfaces] could not read /sys/class/net', e);
    return [];
  }
}
