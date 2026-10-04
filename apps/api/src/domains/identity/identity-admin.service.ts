import {
  AuthProviderType,
  AuthRequirementTarget,
  Prisma,
} from '@prisma/client';
import prisma from '../../config/database';
import { ValidationError, NotFoundError } from '../../shared/errors/app-error';
import { ensureIdentityDefaults, ADMIN_PORTAL_SLUG } from './services/policy.service';
import { authAbuseService, authAuditService } from './services/auth-audit-abuse.service';

export class IdentityAdminService {
  async bootstrap() {
    await ensureIdentityDefaults();
  }

  async listProviders() {
    await ensureIdentityDefaults();
    return prisma.authProviderConfig.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] });
  }

  async updateProvider(
    id: string,
    data: { enabled?: boolean; name?: string; config?: Prisma.InputJsonValue; priority?: number }
  ) {
    const existing = await prisma.authProviderConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Auth provider not found');

    // Local may be disabled only if at least one other enabled provider is linked to admin_portal
    if (existing.type === AuthProviderType.local && data.enabled === false) {
      const policy = await prisma.authPolicy.findUnique({
        where: { slug: ADMIN_PORTAL_SLUG },
        include: { providers: { include: { provider: true } } },
      });
      const others =
        policy?.providers.filter(
          (p) => p.providerId !== id && p.provider.enabled && p.provider.type !== AuthProviderType.local
        ) ?? [];
      if (others.length === 0) {
        throw new ValidationError(
          'Cannot disable Local authentication until another IdP is enabled and allowed on the Admin portal policy'
        );
      }
    }

    // Stub providers (coming_soon) cannot be enabled yet
    const cfg = (existing.config ?? {}) as Record<string, unknown>;
    if (data.enabled === true && cfg.status === 'coming_soon') {
      throw new ValidationError(
        `${existing.name} is not implemented yet. Local authentication remains available.`
      );
    }

    return prisma.authProviderConfig.update({
      where: { id },
      data: {
        enabled: data.enabled,
        name: data.name,
        config: data.config === undefined ? undefined : (data.config as Prisma.InputJsonValue),
        priority: data.priority,
      },
    });
  }

  async listPolicies() {
    await ensureIdentityDefaults();
    return prisma.authPolicy.findMany({
      include: {
        providers: { include: { provider: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updatePolicy(
    id: string,
    data: {
      name?: string;
      enabled?: boolean;
      requireMfa?: boolean;
      groupAllow?: string[];
      groupDeny?: string[];
      sessionTtlMinutes?: number | null;
      description?: string | null;
      providerIds?: string[];
    }
  ) {
    const existing = await prisma.authPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Auth policy not found');

    if (data.providerIds) {
      if (data.providerIds.length === 0) {
        throw new ValidationError('A policy must allow at least one identity provider');
      }
      if (existing.slug === ADMIN_PORTAL_SLUG) {
        const providers = await prisma.authProviderConfig.findMany({
          where: { id: { in: data.providerIds } },
        });
        const hasLocal = providers.some((p) => p.type === AuthProviderType.local && p.enabled);
        const hasOtherEnabled = providers.some(
          (p) => p.type !== AuthProviderType.local && p.enabled
        );
        if (!hasLocal && !hasOtherEnabled) {
          throw new ValidationError(
            'Admin portal policy must include Local or another enabled IdP'
          );
        }
        // Strongly prefer keeping Local on admin portal — require Local unless explicitly replaced by enabled other
        if (!providers.some((p) => p.type === AuthProviderType.local) && !hasOtherEnabled) {
          throw new ValidationError('Admin portal policy must include the Local provider');
        }
      }

      await prisma.authPolicyProvider.deleteMany({ where: { policyId: id } });
      await prisma.authPolicyProvider.createMany({
        data: data.providerIds.map((providerId) => ({ policyId: id, providerId })),
      });
    }

    return prisma.authPolicy.update({
      where: { id },
      data: {
        name: data.name,
        enabled: data.enabled,
        requireMfa: data.requireMfa,
        groupAllow: data.groupAllow,
        groupDeny: data.groupDeny,
        sessionTtlMinutes: data.sessionTtlMinutes,
        description: data.description,
      },
      include: { providers: { include: { provider: true } } },
    });
  }

  async createGatewayPolicy(data: {
    name: string;
    domainId: string;
    providerIds: string[];
    requireMfa?: boolean;
    groupAllow?: string[];
    groupDeny?: string[];
    description?: string;
  }) {
    if (!data.providerIds?.length) {
      throw new ValidationError('Select at least one identity provider');
    }
    const slug = `gateway:${data.domainId}`;
    const existing = await prisma.authPolicy.findUnique({ where: { slug } });
    if (existing) {
      throw new ValidationError('An access gateway policy already exists for this domain');
    }

    return prisma.authPolicy.create({
      data: {
        name: data.name,
        slug,
        target: AuthRequirementTarget.access_gateway,
        domainId: data.domainId,
        enabled: true,
        requireMfa: data.requireMfa ?? false,
        groupAllow: data.groupAllow ?? [],
        groupDeny: data.groupDeny ?? [],
        description: data.description,
        providers: {
          create: data.providerIds.map((providerId) => ({ providerId })),
        },
      },
      include: { providers: { include: { provider: true } } },
    });
  }

  listAuditLogs = authAuditService.list.bind(authAuditService);
  getAbuseSettings = authAbuseService.getSettings.bind(authAbuseService);
  updateAbuseSettings = authAbuseService.updateSettings.bind(authAbuseService);
  listAbuseStates = authAbuseService.listStates.bind(authAbuseService);
  clearAbuseState = authAbuseService.clearState.bind(authAbuseService);
}

export const identityAdminService = new IdentityAdminService();
