import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import { ResponseUtil } from '../../shared/utils/response.util';
import { firewallService } from './firewall.service';
import { getCrowdsecStatus, getCrowdsecDecisionsPreview } from './crowdsec-status.service';
import { getNftTableRuntime } from './nft-runtime.service';
import { FirewallSetKind } from '@prisma/client';

const KINDS = new Set<string>(Object.values(FirewallSetKind));

function parseKind(s: unknown): FirewallSetKind | null {
  if (typeof s !== 'string' || !KINDS.has(s)) return null;
  return s as FirewallSetKind;
}

export const getFirewallState = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const state = await firewallService.getState();
    ResponseUtil.success(res, state);
  } catch (error: unknown) {
    logger.error('getFirewallState', error);
    ResponseUtil.error(res, 'Failed to load firewall state', 500);
  }
};

export const updateFirewallSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const settings = await firewallService.updateSettings({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      sshPort: typeof body.sshPort === 'number' ? body.sshPort : undefined,
      apiPort: typeof body.apiPort === 'number' ? body.apiPort : undefined,
      uiPort: typeof body.uiPort === 'number' ? body.uiPort : undefined,
      publicTcpPorts: Array.isArray(body.publicTcpPorts)
        ? (body.publicTcpPorts as unknown[]).filter((x): x is number => typeof x === 'number')
        : undefined,
      crowdsecNftSetV4: typeof body.crowdsecNftSetV4 === 'string' ? body.crowdsecNftSetV4 : undefined,
      crowdsecNftSetV6: typeof body.crowdsecNftSetV6 === 'string' ? body.crowdsecNftSetV6 : undefined,
    });
    ResponseUtil.success(res, settings, 'Firewall settings updated');
  } catch (error: unknown) {
    logger.error('updateFirewallSettings', error);
    ResponseUtil.error(res, error instanceof Error ? error.message : 'Update failed', 500);
  }
};

export const addFirewallEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const kind = parseKind(body.kind);
    if (!kind || typeof body.cidr !== 'string') {
      ResponseUtil.error(res, 'kind (trusted_ipv4|trusted_ipv6|local_deny_ipv4|local_deny_ipv6) and cidr are required', 400);
      return;
    }
    const label = typeof body.label === 'string' ? body.label : undefined;
    const entry = await firewallService.addEntry(kind, body.cidr, label);
    ResponseUtil.success(res, entry, 'Entry added');
  } catch (error: unknown) {
    logger.error('addFirewallEntry', error);
    const msg = error instanceof Error ? error.message : 'Failed to add entry';
    ResponseUtil.error(res, msg, 400);
  }
};

export const deleteFirewallEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      ResponseUtil.error(res, 'Missing id', 400);
      return;
    }
    await firewallService.removeEntry(id);
    ResponseUtil.success(res, { ok: true }, 'Entry removed');
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      ResponseUtil.error(res, 'Entry not found', 404);
      return;
    }
    logger.error('deleteFirewallEntry', error);
    ResponseUtil.error(res, error instanceof Error ? error.message : 'Failed to delete', 500);
  }
};

export const previewFirewall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const preview = await firewallService.previewRuleset();
    ResponseUtil.success(res, preview);
  } catch (error: unknown) {
    logger.error('previewFirewall', error);
    ResponseUtil.error(res, 'Failed to render ruleset', 500);
  }
};

export const applyFirewall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = (req.body || {}) as { confirmLockoutRisk?: boolean };
    const result = await firewallService.apply({
      confirmLockoutRisk: body.confirmLockoutRisk === true,
    });
    if (!result.success) {
      ResponseUtil.error(res, result.error || result.message, 500);
      return;
    }
    ResponseUtil.success(res, result, result.message);
  } catch (error: unknown) {
    logger.error('applyFirewall', error);
    const msg = error instanceof Error ? error.message : 'Apply failed';
    const code = msg.includes('Refusing to enable') ? 400 : 500;
    ResponseUtil.error(res, msg, code);
  }
};

export const crowdsecStatus = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await getCrowdsecStatus();
    ResponseUtil.success(res, data);
  } catch (error: unknown) {
    logger.error('crowdsecStatus', error);
    ResponseUtil.error(res, 'Failed to read CrowdSec status', 500);
  }
};

export const nftRuntime = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await getNftTableRuntime();
    ResponseUtil.success(res, data);
  } catch (error: unknown) {
    logger.error('nftRuntime', error);
    ResponseUtil.error(res, 'Failed to read nft runtime state', 500);
  }
};

export const crowdsecDecisions = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await getCrowdsecDecisionsPreview();
    ResponseUtil.success(res, data);
  } catch (error: unknown) {
    logger.error('crowdsecDecisions', error);
    ResponseUtil.error(res, 'Failed to fetch CrowdSec decisions', 500);
  }
};
