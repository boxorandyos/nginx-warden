import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NFT_TABLE_NAME } from './nftables-render.service';

const execFileAsync = promisify(execFile);

export type NftRuntimePayload = {
  available: boolean;
  output?: string;
  error?: string;
};

function isNftTableMissingError(stderr: string, message: string): boolean {
  const combined = `${stderr}\n${message}`;
  if (!/No such file or directory|does not exist|Could not process rule/i.test(combined)) {
    return false;
  }
  return (
    combined.includes(NFT_TABLE_NAME) ||
    combined.includes('list table') ||
    combined.includes('list table inet')
  );
}

/**
 * Read current kernel nftables state for the managed table (admin diagnostics).
 * If the table was never created (no rules applied yet), nft exits with an error — we treat that as an empty state, not a failure.
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
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { stderr?: Buffer | string };
    if (err.code === 'ENOENT') {
      return {
        available: false,
        error: `nft not found (${nftPath}). Install nftables (e.g. apt install nftables) or set NFT_BINARY.`,
      };
    }
    const stderr = Buffer.isBuffer(err.stderr) ? err.stderr.toString('utf8') : String(err.stderr || '');
    const msg = e instanceof Error ? e.message : String(e);
    if (isNftTableMissingError(stderr, msg)) {
      return {
        available: true,
        output:
          `Table inet ${NFT_TABLE_NAME} is not loaded yet — this is normal before the first firewall rules are applied from Fleet → Firewall, or if nftables has not been applied on this host.\n\n` +
          `After you apply rules (or load a ruleset that creates this table), this panel will show the live nft output.`,
      };
    }
    return {
      available: false,
      error: stderr.trim() || msg,
    };
  }
}
