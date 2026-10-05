import axios from 'axios';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { planSlaveUpgrades, type MaintenanceKind } from './maintenance';
import { runGithubUpdateAndInstallScript, runPackageUpdateScript, type SystemUpdateResult } from './system-update.service';

export async function runLocalMaintenance(kind: MaintenanceKind): Promise<SystemUpdateResult> {
  if (kind === 'packages') return runPackageUpdateScript();
  return runGithubUpdateAndInstallScript();
}

export async function triggerSlaveUpgrades(kind: MaintenanceKind, nodeId?: string): Promise<
  Array<{ id: string; name: string; status: number; message: string }>
> {
  const config = await prisma.systemConfig.findFirst();
  if (config?.nodeMode === 'slave') {
    throw new Error('Only the master can trigger slave upgrades');
  }

  const nodes = await prisma.slaveNode.findMany({
    where: nodeId ? { id: nodeId } : undefined,
    select: { id: true, name: true, host: true, port: true, apiKey: true, syncEnabled: true },
  });
  if (nodeId && nodes.length === 0) {
    throw new Error('Slave node not found');
  }

  const calls = planSlaveUpgrades(nodes, kind);
  const results: Array<{ id: string; name: string; status: number; message: string }> = [];
  for (const call of calls) {
    try {
      const response = await axios.post(call.url, call.body, {
        headers: call.headers,
        timeout: 20000,
        validateStatus: () => true,
      });
      const message = typeof response.data?.message === 'string' ? response.data.message : '';
      results.push({ id: call.id, name: call.name, status: response.status, message });
      logger.info('Slave maintenance response', { nodeId: call.id, name: call.name, status: response.status, kind });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed';
      results.push({ id: call.id, name: call.name, status: 0, message });
      logger.error('Slave maintenance request failed', { nodeId: call.id, name: call.name, message });
    }
  }
  return results;
}
