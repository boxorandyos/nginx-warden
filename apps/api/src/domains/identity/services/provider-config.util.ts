import { AuthProviderType, UserRole } from '@prisma/client';
import { ValidationError } from '../../../shared/errors/app-error';

export interface LdapProviderConfig {
  url: string;
  bindDn?: string;
  bindPassword?: string;
  searchBase: string;
  /** Use {{username}} placeholder */
  searchFilter: string;
  emailAttr?: string;
  nameAttr?: string;
  groupBase?: string;
  groupFilter?: string;
  groupNameAttr?: string;
  startTls?: boolean;
  tlsRejectUnauthorized?: boolean;
  /** Map LDAP group name → UserRole */
  roleMap?: Record<string, UserRole>;
  defaultRole?: UserRole;
}

export interface OidcProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  scopes?: string;
  /** Claim path for groups (default groups) */
  groupClaim?: string;
  emailClaim?: string;
  nameClaim?: string;
  roleMap?: Record<string, UserRole>;
  defaultRole?: UserRole;
  /** Entra tenant id used to build issuer if issuer empty */
  entraTenantId?: string;
}

const SECRET_KEYS = new Set(['bindPassword', 'clientSecret']);

export function maskProviderConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const out: Record<string, unknown> = { ...(config as Record<string, unknown>) };
  for (const k of Object.keys(out)) {
    if (SECRET_KEYS.has(k) && out[k]) {
      out[k] = '********';
      out[`${k}Set`] = true;
    }
  }
  return out;
}

/** Merge update onto existing; keep previous secrets when masked/blank */
export function mergeProviderConfig(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...existing, ...incoming };
  for (const k of SECRET_KEYS) {
    const v = incoming[k];
    if (v === undefined || v === '' || v === '********') {
      if (existing[k]) merged[k] = existing[k];
      else delete merged[k];
    }
  }
  delete merged.bindPasswordSet;
  delete merged.clientSecretSet;
  delete merged.status;
  return merged;
}

export function validateLdapConfig(raw: Record<string, unknown>): LdapProviderConfig {
  const url = String(raw.url || '').trim();
  const searchBase = String(raw.searchBase || '').trim();
  const searchFilter = String(raw.searchFilter || '(uid={{username}})').trim();
  if (!url) throw new ValidationError('LDAP URL is required (ldaps://… preferred)');
  if (!/^ldaps?:\/\//i.test(url)) {
    throw new ValidationError('LDAP URL must start with ldap:// or ldaps://');
  }
  if (url.toLowerCase().startsWith('ldap://') && !raw.startTls) {
    throw new ValidationError('Plain ldap:// requires startTls=true, or use ldaps://');
  }
  if (!searchBase) throw new ValidationError('LDAP searchBase is required');
  if (!searchFilter.includes('{{username}}')) {
    throw new ValidationError('LDAP searchFilter must include {{username}}');
  }
  return {
    url,
    bindDn: raw.bindDn ? String(raw.bindDn) : undefined,
    bindPassword: raw.bindPassword ? String(raw.bindPassword) : undefined,
    searchBase,
    searchFilter,
    emailAttr: String(raw.emailAttr || 'mail'),
    nameAttr: String(raw.nameAttr || 'cn'),
    groupBase: raw.groupBase ? String(raw.groupBase) : undefined,
    groupFilter: raw.groupFilter ? String(raw.groupFilter) : undefined,
    groupNameAttr: String(raw.groupNameAttr || 'cn'),
    startTls: Boolean(raw.startTls),
    tlsRejectUnauthorized: raw.tlsRejectUnauthorized !== false,
    roleMap: (raw.roleMap as Record<string, UserRole>) || undefined,
    defaultRole: (raw.defaultRole as UserRole) || UserRole.viewer,
  };
}

export function validateOidcConfig(
  type: AuthProviderType,
  raw: Record<string, unknown>
): OidcProviderConfig {
  let issuer = String(raw.issuer || '').trim();
  const entraTenantId = raw.entraTenantId ? String(raw.entraTenantId).trim() : undefined;
  if (!issuer && type === AuthProviderType.oidc_entra && entraTenantId) {
    issuer = `https://login.microsoftonline.com/${entraTenantId}/v2.0`;
  }
  const clientId = String(raw.clientId || '').trim();
  if (!issuer) throw new ValidationError('OIDC issuer URL is required');
  if (!clientId) throw new ValidationError('OIDC client ID is required');
  try {
    // eslint-disable-next-line no-new
    new URL(issuer);
  } catch {
    throw new ValidationError('OIDC issuer must be a valid URL');
  }
  return {
    issuer: issuer.replace(/\/$/, ''),
    clientId,
    clientSecret: raw.clientSecret ? String(raw.clientSecret) : undefined,
    scopes: String(raw.scopes || 'openid profile email'),
    groupClaim: String(raw.groupClaim || 'groups'),
    emailClaim: String(raw.emailClaim || 'email'),
    nameClaim: String(raw.nameClaim || 'name'),
    roleMap: (raw.roleMap as Record<string, UserRole>) || undefined,
    defaultRole: (raw.defaultRole as UserRole) || UserRole.viewer,
    entraTenantId,
  };
}

export function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\\\0]/g, (ch) => {
    const map: Record<string, string> = {
      '\\': '\\5c',
      '*': '\\2a',
      '(': '\\28',
      ')': '\\29',
      '\0': '\\00',
    };
    return map[ch] || ch;
  });
}

export function mapGroupsToRole(
  groups: string[],
  roleMap?: Record<string, UserRole>,
  defaultRole: UserRole = UserRole.viewer
): UserRole {
  if (!roleMap) return defaultRole;
  const lower = groups.map((g) => g.toLowerCase());
  // Prefer highest privilege match
  const order: UserRole[] = [UserRole.admin, UserRole.moderator, UserRole.viewer];
  for (const role of order) {
    for (const [group, mapped] of Object.entries(roleMap)) {
      if (mapped === role && lower.includes(group.toLowerCase())) {
        return role;
      }
    }
  }
  return defaultRole;
}
