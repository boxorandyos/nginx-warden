import prisma from '../../config/database';
import { BackupSchedule, BackupFile, Prisma } from '@prisma/client';
import { BackupScheduleWithFiles, BackupFileWithSchedule } from './backup.types';

/**
 * Backup Repository - Handles all database operations for backups
 */
export class BackupRepository {
  /**
   * Find all backup schedules with their latest backup
   */
  async findAllSchedules(): Promise<BackupScheduleWithFiles[]> {
    return prisma.backupSchedule.findMany({
      include: {
        backups: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find backup schedule by ID with all backups
   */
  async findScheduleById(id: string): Promise<BackupScheduleWithFiles | null> {
    return prisma.backupSchedule.findUnique({
      where: { id },
      include: {
        backups: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Create backup schedule
   */
  async createSchedule(
    data: Prisma.BackupScheduleCreateInput
  ): Promise<BackupSchedule> {
    return prisma.backupSchedule.create({
      data,
    });
  }

  /**
   * Update backup schedule
   */
  async updateSchedule(
    id: string,
    data: Prisma.BackupScheduleUpdateInput
  ): Promise<BackupSchedule> {
    return prisma.backupSchedule.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete backup schedule
   */
  async deleteSchedule(id: string): Promise<BackupSchedule> {
    return prisma.backupSchedule.delete({
      where: { id },
    });
  }

  /**
   * Find all backup files
   */
  async findAllBackupFiles(scheduleId?: string): Promise<BackupFileWithSchedule[]> {
    return prisma.backupFile.findMany({
      where: scheduleId ? { scheduleId } : {},
      include: {
        schedule: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find backup file by ID
   */
  async findBackupFileById(id: string): Promise<BackupFile | null> {
    return prisma.backupFile.findUnique({
      where: { id },
    });
  }

  /**
   * Create backup file record
   */
  async createBackupFile(
    data: Prisma.BackupFileCreateInput
  ): Promise<BackupFile> {
    return prisma.backupFile.create({
      data,
    });
  }

  /**
   * Delete backup file record
   */
  async deleteBackupFile(id: string): Promise<BackupFile> {
    return prisma.backupFile.delete({
      where: { id },
    });
  }

  /**
   * Get all domains with full relations for backup
   */
  async getAllDomainsForBackup() {
    return prisma.domain.findMany({
      include: {
        upstreams: true,
        loadBalancer: true,
        sslCertificate: true,
      },
    });
  }

  /**
   * Get all SSL certificates with domain info
   */
  async getAllSSLCertificates() {
    return prisma.sSLCertificate.findMany({
      include: {
        domain: true,
      },
    });
  }

  /**
   * Get all ModSecurity CRS rules
   */
  async getAllModSecCRSRules() {
    return prisma.modSecCRSRule.findMany();
  }

  /**
   * Get all ModSecurity custom rules
   */
  async getAllModSecCustomRules() {
    return prisma.modSecRule.findMany();
  }

  /**
   * Get all ACL rules
   */
  async getAllACLRules() {
    return prisma.aclRule.findMany();
  }

  /**
   * Get all notification channels
   */
  async getAllNotificationChannels() {
    return prisma.notificationChannel.findMany();
  }

  /**
   * Get all alert rules with channels
   */
  async getAllAlertRules() {
    return prisma.alertRule.findMany({
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });
  }

  /**
   * Get all users with profiles
   */
  async getAllUsers() {
    return prisma.user.findMany({
      include: {
        profile: true,
      },
    });
  }

  /**
   * Get all nginx configs
   */
  async getAllNginxConfigs() {
    return prisma.nginxConfig.findMany();
  }

  /**
   * Find domain by name
   */
  async findDomainByName(name: string) {
    return prisma.domain.findUnique({
      where: { name },
    });
  }

  /**
   * Upsert domain
   */
  async upsertDomain(name: string, createData: any, updateData: any) {
    return prisma.domain.upsert({
      where: { name },
      update: updateData,
      create: createData,
    });
  }

  /**
   * Delete upstreams by domain ID
   */
  async deleteUpstreamsByDomainId(domainId: string) {
    return prisma.upstream.deleteMany({
      where: { domainId },
    });
  }

  /**
   * Create upstream
   */
  async createUpstream(data: Prisma.UpstreamCreateInput) {
    return prisma.upstream.create({
      data,
    });
  }

  /**
   * Upsert load balancer config
   */
  async upsertLoadBalancerConfig(domainId: string, data: any) {
    return prisma.loadBalancerConfig.upsert({
      where: { domainId },
      update: data,
      create: { domainId, ...data },
    });
  }

  /**
   * Upsert SSL certificate
   */
  async upsertSSLCertificate(domainId: string, createData: any, updateData: any) {
    return prisma.sSLCertificate.upsert({
      where: { domainId },
      update: updateData,
      create: createData,
    });
  }

  /**
   * Upsert ModSec CRS rule
   */
  async upsertModSecCRSRule(ruleFile: string, domainId: string | null, data: any) {
    return prisma.modSecCRSRule.upsert({
      where: {
        ruleFile_domainId: {
          ruleFile,
          domainId: domainId as any,
        },
      },
      update: data,
      create: { ruleFile, domainId, ...data },
    });
  }

  /**
   * Create ModSec custom rule
   */
  async createModSecRule(data: Prisma.ModSecRuleCreateInput) {
    return prisma.modSecRule.create({
      data,
    });
  }

  /**
   * Create ACL rule
   */
  async createACLRule(data: Prisma.AclRuleCreateInput) {
    return prisma.aclRule.create({
      data,
    });
  }

  /**
   * Create notification channel
   */
  async createNotificationChannel(data: Prisma.NotificationChannelCreateInput) {
    return prisma.notificationChannel.create({
      data,
    });
  }

  /**
   * Create alert rule
   */
  async createAlertRule(data: Prisma.AlertRuleCreateInput) {
    return prisma.alertRule.create({
      data,
    });
  }

  /**
   * Find notification channel by name
   */
  async findNotificationChannelByName(name: string) {
    return prisma.notificationChannel.findFirst({
      where: { name },
    });
  }

  /**
   * Create alert rule channel
   */
  async createAlertRuleChannel(ruleId: string, channelId: string) {
    return prisma.alertRuleChannel.create({
      data: { ruleId, channelId },
    });
  }

  /**
   * Upsert user
   */
  async upsertUser(username: string, createData: any, updateData: any) {
    return prisma.user.upsert({
      where: { username },
      update: updateData,
      create: createData,
    });
  }

  /**
   * Upsert user profile
   */
  async upsertUserProfile(userId: string, data: any) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  /**
   * Upsert nginx config
   */
  async upsertNginxConfig(id: string, createData: any, updateData: any) {
    return prisma.nginxConfig.upsert({
      where: { id },
      update: updateData,
      create: { id, ...createData },
    });
  }

  /**
   * Find domain by ID with full relations
   */
  async findDomainByIdWithRelations(id: string) {
    return prisma.domain.findUnique({
      where: { id },
      include: {
        upstreams: true,
        loadBalancer: true,
        sslCertificate: true,
      },
    });
  }

  /**
   * Get all Network Load Balancers for backup
   */
  async getAllNetworkLoadBalancers() {
    return prisma.networkLoadBalancer.findMany({
      include: {
        upstreams: true,
      },
    });
  }

  /**
   * Upsert Network Load Balancer
   */
  async upsertNetworkLoadBalancer(name: string, createData: any, updateData: any) {
    return prisma.networkLoadBalancer.upsert({
      where: { name },
      update: updateData,
      create: { name, ...createData },
    });
  }

  /**
   * Create NLB upstream
   */
  async createNLBUpstream(data: Prisma.NLBUpstreamCreateInput) {
    return prisma.nLBUpstream.create({
      data,
    });
  }

  /**
   * Delete NLB upstreams by NLB ID
   */
  async deleteNLBUpstreamsByNLBId(nlbId: string) {
    return prisma.nLBUpstream.deleteMany({
      where: { nlbId },
    });
  }

  /**
   * Host firewall settings (single row)
   */
  async getFirewallSettingsForBackup() {
    return prisma.firewallSettings.findFirst();
  }

  /**
   * Firewall address entries (trusted / local deny sets)
   */
  async getFirewallAddressEntriesForBackup() {
    return prisma.firewallAddressEntry.findMany({
      orderBy: [{ kind: 'asc' }, { cidr: 'asc' }],
    });
  }

  /**
   * Access lists with auth users and domain links (domain name for portable restore)
   */
  async getAccessListsForBackup() {
    return prisma.accessList.findMany({
      include: {
        authUsers: true,
        domains: { include: { domain: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async upsertFirewallSettingsFromBackup(data: {
    id: string;
    enabled: boolean;
    sshPort: number;
    apiPort: number;
    uiPort: number;
    publicTcpPorts: number[];
    crowdsecNftSetV4: string;
    crowdsecNftSetV6: string;
  }) {
    const id = data.id || 'default';
    return prisma.firewallSettings.upsert({
      where: { id },
      create: {
        id,
        enabled: data.enabled,
        sshPort: data.sshPort,
        apiPort: data.apiPort,
        uiPort: data.uiPort,
        publicTcpPorts: data.publicTcpPorts,
        crowdsecNftSetV4: data.crowdsecNftSetV4,
        crowdsecNftSetV6: data.crowdsecNftSetV6,
      },
      update: {
        enabled: data.enabled,
        sshPort: data.sshPort,
        apiPort: data.apiPort,
        uiPort: data.uiPort,
        publicTcpPorts: data.publicTcpPorts,
        crowdsecNftSetV4: data.crowdsecNftSetV4,
        crowdsecNftSetV6: data.crowdsecNftSetV6,
      },
    });
  }

  async deleteAllFirewallAddressEntries() {
    return prisma.firewallAddressEntry.deleteMany();
  }

  async createFirewallAddressEntry(data: {
    kind: string;
    cidr: string;
    label?: string | null;
  }) {
    return prisma.firewallAddressEntry.create({
      data: {
        kind: data.kind as any,
        cidr: data.cidr,
        label: data.label ?? null,
      },
    });
  }

  /**
   * Replace one access list's users and domain links (by domain name lookup).
   */
  async replaceAccessListFromBackup(data: {
    name: string;
    description?: string | null;
    type: string;
    enabled: boolean;
    allowedIps: string[];
    authUsers: Array<{
      username: string;
      passwordHash: string;
      description?: string | null;
    }>;
    domainLinks: Array<{ domainName: string; enabled: boolean }>;
  }) {
    return prisma.$transaction(async (tx) => {
      const list = await tx.accessList.upsert({
        where: { name: data.name },
        create: {
          name: data.name,
          description: data.description ?? null,
          type: data.type as any,
          enabled: data.enabled,
          allowedIps: data.allowedIps ?? [],
        },
        update: {
          description: data.description ?? null,
          type: data.type as any,
          enabled: data.enabled,
          allowedIps: data.allowedIps ?? [],
        },
      });

      await tx.accessListAuthUser.deleteMany({ where: { accessListId: list.id } });
      for (const u of data.authUsers) {
        await tx.accessListAuthUser.create({
          data: {
            accessListId: list.id,
            username: u.username,
            passwordHash: u.passwordHash,
            description: u.description ?? null,
          },
        });
      }

      await tx.accessListDomain.deleteMany({ where: { accessListId: list.id } });
      for (const link of data.domainLinks) {
        const domain = await tx.domain.findUnique({
          where: { name: link.domainName },
        });
        if (!domain) {
          continue;
        }
        await tx.accessListDomain.create({
          data: {
            accessListId: list.id,
            domainId: domain.id,
            enabled: link.enabled ?? true,
          },
        });
      }

      return list;
    });
  }
}

// Export singleton instance
export const backupRepository = new BackupRepository();
