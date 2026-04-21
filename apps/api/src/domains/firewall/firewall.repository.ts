import prisma from '../../config/database';
import type { Prisma } from '@prisma/client';
import { FirewallSetKind, type FirewallSettings, type FirewallAddressEntry } from '@prisma/client';

const SETTINGS_ID = 'default';

export class FirewallRepository {
  async getSettings(): Promise<FirewallSettings> {
    const row = await prisma.firewallSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (row) return row;
    return prisma.firewallSettings.create({
      data: {
        id: SETTINGS_ID,
        enabled: false,
        sshPort: 22,
        apiPort: 3001,
        uiPort: 8088,
        publicTcpPorts: [80, 443],
        crowdsecNftSetV4: 'crowdsec_blacklists',
        crowdsecNftSetV6: 'crowdsec6_blacklists',
      },
    });
  }

  async updateSettings(data: {
    enabled?: boolean;
    sshPort?: number;
    apiPort?: number;
    uiPort?: number;
    publicTcpPorts?: number[];
    crowdsecNftSetV4?: string;
    crowdsecNftSetV6?: string;
  }): Promise<FirewallSettings> {
    await this.getSettings();
    const update: Prisma.FirewallSettingsUpdateInput = {};
    if (data.enabled !== undefined) update.enabled = data.enabled;
    if (data.sshPort !== undefined) update.sshPort = data.sshPort;
    if (data.apiPort !== undefined) update.apiPort = data.apiPort;
    if (data.uiPort !== undefined) update.uiPort = data.uiPort;
    if (data.publicTcpPorts !== undefined) update.publicTcpPorts = data.publicTcpPorts;
    if (data.crowdsecNftSetV4 !== undefined) update.crowdsecNftSetV4 = data.crowdsecNftSetV4;
    if (data.crowdsecNftSetV6 !== undefined) update.crowdsecNftSetV6 = data.crowdsecNftSetV6;
    if (Object.keys(update).length === 0) {
      return this.getSettings();
    }
    return prisma.firewallSettings.update({
      where: { id: SETTINGS_ID },
      data: update,
    });
  }

  async listEntries(): Promise<FirewallAddressEntry[]> {
    return prisma.firewallAddressEntry.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createEntry(kind: FirewallSetKind, cidr: string, label?: string | null): Promise<FirewallAddressEntry> {
    return prisma.firewallAddressEntry.create({
      data: { kind, cidr, label: label ?? null },
    });
  }

  async deleteEntry(id: string): Promise<void> {
    await prisma.firewallAddressEntry.delete({ where: { id } });
  }

  async appendApplyLog(payload: {
    success: boolean;
    checksum: string | null;
    errorMessage: string | null;
    rulesetSnippet: string | null;
  }): Promise<void> {
    await prisma.firewallApplyLog.create({ data: payload });
  }

  async listApplyLogs(limit: number): Promise<
    { id: string; success: boolean; checksum: string | null; errorMessage: string | null; appliedAt: Date }[]
  > {
    return prisma.firewallApplyLog.findMany({
      orderBy: { appliedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        success: true,
        checksum: true,
        errorMessage: true,
        appliedAt: true,
      },
    });
  }
}

export { SETTINGS_ID, FirewallSetKind };
