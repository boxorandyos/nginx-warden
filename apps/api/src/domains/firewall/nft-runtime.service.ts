import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NFT_TABLE_NAME } from './nftables-render.service';

const execFileAsync = promisify(execFile);

export type NftRuntimePayload = {
  available: boolean;
  output?: string;
  error?: string;
};

/**
 * Read current kernel nftables state for the managed table (admin diagnostics).
 */
export async function getNftTableRuntime(): Promise<NftRuntimePayload> {
  const nftPath = process.env.NFT_BINARY?.trim() || 'nft';
  if (process.platform !== 'linux') {
    return { available: false, error: 'nft only runs on Linux' };
  }
  try {
    const r = await execFileAsync(nftPath, ['list', 'table', 'inet', NFT_TABLE_NAME], {
      timeout: 10000,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'utf8',
    });
    return { available: true, output: r.stdout.slice(0, 120000) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      available: false,
      error: msg,
    };
  }
}
