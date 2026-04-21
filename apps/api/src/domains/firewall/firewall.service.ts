import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FirewallSetKind } from '@prisma/client';
import { FirewallRepository } from './firewall.repository';
import { renderNftablesRuleset, checksumRuleset } from './nftables-render.service';
import { validateCidrForKind } from './firewall-validation';
import logger from '../../utils/logger';

const execFileAsync = promisify(execFile);

const repo = new FirewallRepository();

function varDir(): string {
  return process.env.NGINX_WARDEN_VAR_DIR?.trim() || '/var/lib/nginx-warden';
}

function nftApplyDisabled(): boolean {
  return process.env.NFT_APPLY_DISABLED === '1' || process.env.NFT_APPLY_DISABLED === 'true';
}

function sanitizePublicPorts(ports: number[], settings: { sshPort: number; apiPort: number; uiPort: number }): number[] {
  const deny = new Set([settings.sshPort, settings.apiPort, settings.uiPort, 5432]);
  return [...new Set(ports.filter((p) => p > 0 && p < 65536 && !deny.has(p)))].sort((a, b) => a - b);
}

export class FirewallService {
  async getState() {
    const settings = await repo.getSettings();
    const entries = await repo.listEntries();
    const logs = await repo.listApplyLogs(10);
    return { settings, entries, applyLogs: logs };
  }

  async updateSettings(body: {
    enabled?: boolean;
    sshPort?: number;
    apiPort?: number;
    uiPort?: number;
    publicTcpPorts?: number[];
    crowdsecNftSetV4?: string;
    crowdsecNftSetV6?: string;
  }) {
    const current = await repo.getSettings();
    const merged = {
      ...body,
      publicTcpPorts:
        body.publicTcpPorts !== undefined
          ? sanitizePublicPorts(body.publicTcpPorts, {
              sshPort: body.sshPort ?? current.sshPort,
              apiPort: body.apiPort ?? current.apiPort,
              uiPort: body.uiPort ?? current.uiPort,
            })
          : undefined,
    };
    return repo.updateSettings(merged);
  }

  async addEntry(kind: FirewallSetKind, cidr: string, label?: string) {
    const err = validateCidrForKind(cidr, kind);
    if (err) {
      throw new Error(err);
    }
    return repo.createEntry(kind, cidr.trim(), label);
  }

  async removeEntry(id: string) {
    await repo.deleteEntry(id);
  }

  async previewRuleset(): Promise<{ content: string; checksum: string }> {
    const settings = await repo.getSettings();
    const entries = await repo.listEntries();
    const content = renderNftablesRuleset(settings, entries);
    return { content, checksum: checksumRuleset(content) };
  }

  /**
   * Apply nftables: if disabled, delete managed table; if enabled, validate + nft -f.
   */
  async apply(opts?: { confirmLockoutRisk?: boolean }): Promise<{
    success: boolean;
    checksum: string | null;
    message: string;
    error?: string;
  }> {
    const settings = await repo.getSettings();
    const entries = await repo.listEntries();

    if (settings.enabled) {
      const trustedCount = entries.filter(
        (e) => e.kind === FirewallSetKind.trusted_ipv4 || e.kind === FirewallSetKind.trusted_ipv6
      ).length;
      if (trustedCount === 0 && !opts?.confirmLockoutRisk) {
        throw new Error(
          'Refusing to enable firewall without at least one trusted IPv4 or IPv6 CIDR (SSH/API/UI would be unreachable). Pass confirmLockoutRisk if you really intend this.'
        );
      }
    }

    const nftPath = process.env.NFT_BINARY?.trim() || 'nft';
    const canExecNft = process.platform === 'linux' && !nftApplyDisabled();

    /** Disable: remove managed table */
    if (!settings.enabled) {
      if (!canExecNft) {
        await repo.appendApplyLog({
          success: true,
          checksum: null,
          errorMessage: nftApplyDisabled()
            ? 'NFT_APPLY_DISABLED: table not deleted in kernel'
            : 'Not Linux: nft not executed',
          rulesetSnippet: 'disabled (no ruleset)',
        });
        return {
          success: true,
          checksum: null,
          message: nftApplyDisabled()
            ? 'Firewall disabled in settings (nft delete skipped — NFT_APPLY_DISABLED).'
            : 'Firewall disabled in settings (nft delete skipped on this OS).',
        };
      }
      try {
        await execFileAsync(nftPath, ['delete', 'table', 'inet', 'nginx_warden_filter'], {
          encoding: 'utf8',
        }).catch(() => {
          /* table may not exist */
        });
        await repo.appendApplyLog({
          success: true,
          checksum: null,
          errorMessage: null,
          rulesetSnippet: 'delete table inet nginx_warden_filter',
        });
        return { success: true, checksum: null, message: 'Firewall disabled: managed nftables table removed (if it existed).' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await repo.appendApplyLog({ success: false, checksum: null, errorMessage: msg, rulesetSnippet: null });
        return { success: false, checksum: null, message: 'Could not delete nftables table', error: msg };
      }
    }

    /** Enabled: load ruleset */
    const ruleset = renderNftablesRuleset(settings, entries);
    const checksum = checksumRuleset(ruleset);

    if (!canExecNft) {
      await repo.appendApplyLog({
        success: true,
        checksum,
        errorMessage: nftApplyDisabled()
          ? 'NFT_APPLY_DISABLED: ruleset not loaded into kernel'
          : 'Not Linux: nft not executed',
        rulesetSnippet: ruleset.slice(0, 8000),
      });
      return {
        success: true,
        checksum,
        message: nftApplyDisabled()
          ? 'Ruleset validated but not applied (NFT_APPLY_DISABLED).'
          : 'Ruleset generated but nft not run on this platform.',
      };
    }

    const dir = path.join(varDir(), 'nftables');
    const tmp = path.join(os.tmpdir(), `nginx-warden-${Date.now()}.nft`);

    try {
      await mkdir(dir, { recursive: true });
      await execFileAsync(nftPath, ['delete', 'table', 'inet', 'nginx_warden_filter'], {
        encoding: 'utf8',
      }).catch(() => {
        /* first apply */
      });
      await writeFile(tmp, ruleset, 'utf8');

      try {
        await execFileAsync(nftPath, ['-c', '-f', tmp], { encoding: 'utf8' });
      } catch (e) {
        await unlink(tmp).catch(() => {});
        const msg = e instanceof Error ? e.message : String(e);
        await repo.appendApplyLog({
          success: false,
          checksum: null,
          errorMessage: `nft -c failed: ${msg}`,
          rulesetSnippet: ruleset.slice(0, 8000),
        });
        return { success: false, checksum: null, message: 'Validation failed', error: msg };
      }

      await execFileAsync(nftPath, ['-f', tmp], { encoding: 'utf8' });
      await unlink(tmp).catch(() => {});

      await repo.appendApplyLog({
        success: true,
        checksum,
        errorMessage: null,
        rulesetSnippet: ruleset.slice(0, 8000),
      });

      return { success: true, checksum, message: 'nftables ruleset applied.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('firewall apply failed', e);
      await repo.appendApplyLog({
        success: false,
        checksum: null,
        errorMessage: msg,
        rulesetSnippet: ruleset.slice(0, 8000),
      });
      return { success: false, checksum: null, message: 'Apply failed', error: msg };
    }
  }
}

export const firewallService = new FirewallService();
