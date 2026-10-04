import { AuthProviderType, AuthRequirementTarget, Prisma } from '@prisma/client';
import prisma from '../../../config/database';
import logger from '../../../utils/logger';
import type { IdentityProvider, ResolvedAuthPolicy } from '../identity.types';
import { LocalIdentityProvider } from './local.idp';
import { evaluateGroupRestrictions } from './group-policy.util';

export const ADMIN_PORTAL_SLUG = 'admin_portal';
export { evaluateGroupRestrictions };

/**
 * Ensure Local IdP + admin_portal policy (Local only) + abuse settings exist.
 * Safe to call on every API boot.
 */
export async function ensureIdentityDefaults(): Promise<void> {
  const local = await prisma.authProviderConfig.upsert({
    where: { type_name: { type: AuthProviderType.local, name: 'Local' } },
    create: {
      type: AuthProviderType.local,
      name: 'Local',
      enabled: true,
      isSystem: true,
      priority: 0,
      config: {},
    },
    update: {
      isSystem: true,
    },
  });

  for (const stub of [
    { type: AuthProviderType.ldap, name: 'LDAP / Active Directory', priority: 20 },
    { type: AuthProviderType.oidc_entra, name: 'Microsoft Entra ID', priority: 30 },
    { type: AuthProviderType.oidc_generic, name: 'OpenID Connect', priority: 40 },
  ] as const) {
    const row = await prisma.authProviderConfig.upsert({
      where: { type_name: { type: stub.type, name: stub.name } },
      create: {
        type: stub.type,
        name: stub.name,
        enabled: false,
        isSystem: false,
        priority: stub.priority,
        config: {},
      },
      update: {},
    });
    const cfg = (row.config as Record<string, unknown>) || {};
    if (cfg.status === 'coming_soon') {
      const { status: _removed, ...rest } = cfg;
      await prisma.authProviderConfig.update({
        where: { id: row.id },
        data: { config: rest as Prisma.InputJsonValue },
      });
    }
  }

  let policy = await prisma.authPolicy.findUnique({ where: { slug: ADMIN_PORTAL_SLUG } });
  if (!policy) {
    await prisma.authPolicy.create({
      data: {
        name: 'Admin portal',
        slug: ADMIN_PORTAL_SLUG,
        target: AuthRequirementTarget.admin_portal,
        enabled: true,
        requireMfa: false,
        description:
          'Default gate for the Nginx Warden administration UI. Local authentication only until you explicitly allow additional IdPs.',
        providers: {
          create: [{ providerId: local.id }],
        },
      },
    });
    logger.info(`Created default auth policy ${ADMIN_PORTAL_SLUG}`);
  } else {
    const links = await prisma.authPolicyProvider.count({ where: { policyId: policy.id } });
    if (links === 0) {
      await prisma.authPolicyProvider.create({
        data: { policyId: policy.id, providerId: local.id },
      });
    }
  }

  const abuseCount = await prisma.authAbuseSettings.count();
  if (abuseCount === 0) {
    await prisma.authAbuseSettings.create({ data: {} });
  }
}

export async function resolvePolicy(
  target: AuthRequirementTarget,
  domainId?: string | null
): Promise<ResolvedAuthPolicy | null> {
  const where: Prisma.AuthPolicyWhereInput =
    target === AuthRequirementTarget.access_gateway && domainId
      ? { target, domainId, enabled: true }
      : { target: AuthRequirementTarget.admin_portal, slug: ADMIN_PORTAL_SLUG, enabled: true };

  const policy = await prisma.authPolicy.findFirst({
    where,
    include: {
      providers: { include: { provider: true } },
    },
  });

  if (!policy) return null;

  const enabledLinks = policy.providers.filter((p) => p.provider.enabled);
  return {
    id: policy.id,
    slug: policy.slug,
    name: policy.name,
    target: policy.target,
    domainId: policy.domainId,
    requireMfa: policy.requireMfa,
    groupAllow: policy.groupAllow,
    groupDeny: policy.groupDeny,
    sessionTtlMinutes: policy.sessionTtlMinutes,
    allowedProviderIds: enabledLinks.map((p) => p.provider.id),
    allowedProviderTypes: enabledLinks.map((p) => p.provider.type),
  };
}

export function getIdpForType(type: AuthProviderType): IdentityProvider | null {
  switch (type) {
    case AuthProviderType.local:
      return new LocalIdentityProvider();
    default:
      return null;
  }
}

/** Build IdP instance from DB provider row (Local / LDAP). OIDC is browser-based. */
export async function createPasswordIdp(
  providerId: string
): Promise<{ type: AuthProviderType; idp: IdentityProvider; providerId: string } | null> {
  const row = await prisma.authProviderConfig.findUnique({ where: { id: providerId } });
  if (!row || !row.enabled) return null;
  if (row.type === AuthProviderType.local) {
    return { type: row.type, idp: new LocalIdentityProvider(), providerId: row.id };
  }
  if (row.type === AuthProviderType.ldap) {
    const { validateLdapConfig } = await import('./provider-config.util');
    const { LdapIdentityProvider } = await import('./ldap.idp');
    const cfg = validateLdapConfig((row.config as any) || {});
    return { type: row.type, idp: new LdapIdentityProvider(cfg), providerId: row.id };
  }
  return null;
}
