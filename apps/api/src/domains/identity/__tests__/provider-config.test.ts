import { describe, expect, it } from 'vitest';
import { AuthProviderType } from '@prisma/client';
import {
  escapeLdapFilterValue,
  mapGroupsToRole,
  maskProviderConfig,
  mergeProviderConfig,
  validateLdapConfig,
  validateOidcConfig,
} from '../services/provider-config.util';
import { ValidationError } from '../../../shared/errors/app-error';
import { UserRole } from '@prisma/client';

describe('provider-config.util', () => {
  it('masks secrets and preserves Set flags', () => {
    const masked = maskProviderConfig({
      url: 'ldaps://x',
      bindPassword: 'secret',
      clientSecret: 'oidc-secret',
    });
    expect(masked.bindPassword).toBe('********');
    expect(masked.bindPasswordSet).toBe(true);
    expect(masked.clientSecret).toBe('********');
    expect(masked.clientSecretSet).toBe(true);
    expect(masked.url).toBe('ldaps://x');
  });

  it('merges config without overwriting secrets with mask', () => {
    const merged = mergeProviderConfig(
      { bindPassword: 'real', url: 'ldaps://old' },
      { bindPassword: '********', url: 'ldaps://new', status: 'coming_soon' }
    );
    expect(merged.bindPassword).toBe('real');
    expect(merged.url).toBe('ldaps://new');
    expect(merged.status).toBeUndefined();
  });

  it('validates LDAP and requires startTls for ldap://', () => {
    expect(() =>
      validateLdapConfig({ url: 'ldap://x', searchBase: 'dc=x' })
    ).toThrow(ValidationError);
    const cfg = validateLdapConfig({
      url: 'ldaps://ldap.example.com',
      searchBase: 'ou=people,dc=example,dc=com',
      searchFilter: '(uid={{username}})',
    });
    expect(cfg.url).toBe('ldaps://ldap.example.com');
  });

  it('builds Entra issuer from tenant id', () => {
    const cfg = validateOidcConfig(AuthProviderType.oidc_entra, {
      entraTenantId: 'tenant-1',
      clientId: 'app-id',
    });
    expect(cfg.issuer).toBe('https://login.microsoftonline.com/tenant-1/v2.0');
  });

  it('escapes LDAP filter values and maps roles', () => {
    expect(escapeLdapFilterValue('a*(b)')).toContain('\\2a');
    expect(
      mapGroupsToRole(['Admins'], { admins: UserRole.admin }, UserRole.viewer)
    ).toBe(UserRole.admin);
  });
});
