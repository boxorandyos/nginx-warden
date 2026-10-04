import {
  AuthAbuseKind,
  AuthAuditLevel,
  AuthAuditOutcome,
  AuthProviderType,
  FirewallSetKind,
  Prisma,
} from '@prisma/client';
import prisma from '../../../config/database';
import logger from '../../../utils/logger';
import { FirewallService } from '../../firewall/firewall.service';

export interface AuditWriteInput {
  level?: AuthAuditLevel;
  outcome: AuthAuditOutcome;
  message: string;
  ip: string;
  userAgent: string;
  providerType?: AuthProviderType | null;
  providerId?: string | null;
  policyId?: string | null;
  userId?: string | null;
  username?: string | null;
  details?: Prisma.InputJsonValue;
}

export class AuthAuditService {
  async write(input: AuditWriteInput): Promise<void> {
    try {
      await prisma.authAuditLog.create({
        data: {
          level: input.level ?? (input.outcome === 'failure' || input.outcome === 'lockout' || input.outcome === 'blocked' ? AuthAuditLevel.warn : AuthAuditLevel.info),
          outcome: input.outcome,
          message: input.message,
          ip: input.ip,
          userAgent: input.userAgent,
          providerType: input.providerType ?? undefined,
          providerId: input.providerId ?? undefined,
          policyId: input.policyId ?? undefined,
          userId: input.userId ?? undefined,
          username: input.username ?? undefined,
          details: input.details ?? undefined,
        },
      });
    } catch (e) {
      logger.error('Failed to write auth audit log', e);
    }
  }

  async list(params: {
    page?: number;
    limit?: number;
    outcome?: AuthAuditOutcome;
    level?: AuthAuditLevel;
    username?: string;
    ip?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));
    const where: Prisma.AuthAuditLogWhereInput = {};
    if (params.outcome) where.outcome = params.outcome;
    if (params.level) where.level = params.level;
    if (params.username) where.username = { contains: params.username, mode: 'insensitive' };
    if (params.ip) where.ip = { contains: params.ip };

    const [total, items] = await Promise.all([
      prisma.authAuditLog.count({ where }),
      prisma.authAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}

function userKey(userId: string) {
  return `user:${userId}`;
}
function ipKey(ip: string) {
  return `ip:${ip}`;
}
const GLOBAL_KEY = 'global';

export class AuthAbuseService {
  private firewall = new FirewallService();

  async getSettings() {
    let row = await prisma.authAbuseSettings.findFirst();
    if (!row) {
      row = await prisma.authAbuseSettings.create({ data: {} });
    }
    return row;
  }

  async updateSettings(data: Prisma.AuthAbuseSettingsUpdateInput) {
    const current = await this.getSettings();
    return prisma.authAbuseSettings.update({
      where: { id: current.id },
      data,
    });
  }

  /** Throws AuthenticationError-compatible message if blocked */
  async assertAllowed(opts: { userId?: string | null; ip: string }): Promise<void> {
    const settings = await this.getSettings();
    const now = new Date();

    if (settings.authDisabledUntil && settings.authDisabledUntil > now) {
      throw new Error('AUTH_CIRCUIT_OPEN');
    }

    const global = await prisma.authAbuseState.findUnique({ where: { key: GLOBAL_KEY } });
    if (global?.permanentlyBlocked) {
      throw new Error('AUTH_CIRCUIT_OPEN');
    }
    if (global?.lockedUntil && global.lockedUntil > now) {
      throw new Error('AUTH_CIRCUIT_OPEN');
    }

    const ipState = await prisma.authAbuseState.findUnique({ where: { key: ipKey(opts.ip) } });
    if (ipState?.permanentlyBlocked) {
      throw new Error('AUTH_IP_BLOCKED');
    }
    if (ipState?.lockedUntil && ipState.lockedUntil > now) {
      throw new Error('AUTH_IP_LOCKED');
    }

    if (opts.userId) {
      const userState = await prisma.authAbuseState.findUnique({
        where: { key: userKey(opts.userId) },
      });
      if (userState?.permanentlyBlocked) {
        throw new Error('AUTH_USER_BLOCKED');
      }
      if (userState?.lockedUntil && userState.lockedUntil > now) {
        throw new Error('AUTH_USER_LOCKED');
      }
    }
  }

  async recordFailure(opts: {
    userId?: string | null;
    ip: string;
    username?: string | null;
  }): Promise<{
    userLocked: boolean;
    ipLocked: boolean;
    ipFirewallBanned: boolean;
    circuitOpen: boolean;
  }> {
    const settings = await this.getSettings();
    const windowMs = settings.windowMinutes * 60_000;
    const now = new Date();

    let userLocked = false;
    let ipLocked = false;
    let ipFirewallBanned = false;
    let circuitOpen = false;

    if (opts.userId) {
      const r = await this.bumpCounter({
        key: userKey(opts.userId),
        kind: AuthAbuseKind.user,
        windowMs,
        max: settings.maxFailuresPerUser,
        lockMinutes: settings.userLockMinutes,
        now,
      });
      userLocked = r.locked;
    }

    if (settings.ipBanEnabled) {
      const r = await this.bumpCounter({
        key: ipKey(opts.ip),
        kind: AuthAbuseKind.ip,
        windowMs,
        max: settings.maxFailuresPerIp,
        lockMinutes: settings.userLockMinutes,
        now,
      });
      ipLocked = r.locked;

      if (r.count >= settings.ipFirewallBanAfter) {
        ipFirewallBanned = await this.tryFirewallBan(opts.ip);
      }
    }

    const global = await this.bumpCounter({
      key: GLOBAL_KEY,
      kind: AuthAbuseKind.global,
      windowMs,
      max: settings.maxFailuresBeforeAuthDisable,
      lockMinutes: settings.authCircuitMinutes,
      now,
    });
    if (global.locked) {
      circuitOpen = true;
      await prisma.authAbuseSettings.update({
        where: { id: settings.id },
        data: {
          authDisabledUntil: new Date(now.getTime() + settings.authCircuitMinutes * 60_000),
        },
      });
    }

    return { userLocked, ipLocked, ipFirewallBanned, circuitOpen };
  }

  async recordSuccess(opts: { userId?: string | null; ip: string }): Promise<void> {
    if (opts.userId) {
      await prisma.authAbuseState.deleteMany({ where: { key: userKey(opts.userId) } });
    }
    // Do not clear IP on success — shared IPs; only clear on expiry / admin unlock
  }

  async listStates() {
    return prisma.authAbuseState.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
  }

  async clearState(key: string) {
    await prisma.authAbuseState.deleteMany({ where: { key } });
    if (key === GLOBAL_KEY) {
      const s = await this.getSettings();
      await prisma.authAbuseSettings.update({
        where: { id: s.id },
        data: { authDisabledUntil: null },
      });
    }
  }

  private async bumpCounter(opts: {
    key: string;
    kind: AuthAbuseKind;
    windowMs: number;
    max: number;
    lockMinutes: number;
    now: Date;
  }): Promise<{ count: number; locked: boolean }> {
    const existing = await prisma.authAbuseState.findUnique({ where: { key: opts.key } });
    let failureCount = 1;
    let windowStartedAt = opts.now;

    if (existing) {
      const windowExpired =
        opts.now.getTime() - existing.windowStartedAt.getTime() > opts.windowMs;
      if (windowExpired) {
        failureCount = 1;
        windowStartedAt = opts.now;
      } else {
        failureCount = existing.failureCount + 1;
        windowStartedAt = existing.windowStartedAt;
      }
    }

    const locked = failureCount >= opts.max;
    const lockedUntil = locked
      ? new Date(opts.now.getTime() + opts.lockMinutes * 60_000)
      : existing?.lockedUntil && existing.lockedUntil > opts.now
        ? existing.lockedUntil
        : null;

    await prisma.authAbuseState.upsert({
      where: { key: opts.key },
      create: {
        key: opts.key,
        kind: opts.kind,
        failureCount,
        windowStartedAt,
        lockedUntil,
        lastFailureAt: opts.now,
      },
      update: {
        failureCount,
        windowStartedAt,
        lockedUntil,
        lastFailureAt: opts.now,
      },
    });

    return { count: failureCount, locked };
  }

  private async tryFirewallBan(ip: string): Promise<boolean> {
    try {
      // Single host as /32 or /128
      const isV6 = ip.includes(':');
      const cidr = isV6 ? `${ip}/128` : `${ip}/32`;
      const kind = isV6 ? FirewallSetKind.local_deny_ipv6 : FirewallSetKind.local_deny_ipv4;
      await this.firewall.addEntry(kind, cidr, `auth-abuse:${ip}`);
      // Apply nftables if possible
      await this.firewall.apply().catch((e) => {
        logger.warn('Auth abuse firewall apply failed (entry may still be stored)', e);
      });
      return true;
    } catch (e) {
      logger.warn(`Auth abuse could not ban IP ${ip}`, e);
      return false;
    }
  }
}

export const authAuditService = new AuthAuditService();
export const authAbuseService = new AuthAbuseService();
