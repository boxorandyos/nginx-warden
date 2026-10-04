import { Client } from 'ldapts';
import { AuthProviderType, UserRole } from '@prisma/client';
import type {
  IdpAuthenticateInput,
  IdpAuthenticateResult,
  IdentityProvider,
} from '../identity.types';
import {
  escapeLdapFilterValue,
  mapGroupsToRole,
  type LdapProviderConfig,
} from './provider-config.util';
import logger from '../../../utils/logger';

export class LdapIdentityProvider implements IdentityProvider {
  readonly type = AuthProviderType.ldap;

  constructor(private readonly cfg: LdapProviderConfig) {}

  async authenticate(input: IdpAuthenticateInput): Promise<IdpAuthenticateResult> {
    const username = input.username.trim();
    if (!username || !input.password) {
      return { ok: false, reason: 'Invalid credentials' };
    }

    const client = new Client({
      url: this.cfg.url,
      timeout: 10_000,
      connectTimeout: 10_000,
      tlsOptions: {
        rejectUnauthorized: this.cfg.tlsRejectUnauthorized !== false,
      },
    });

    try {
      if (this.cfg.startTls) {
        await client.startTLS();
      }

      // Optional service account search bind
      if (this.cfg.bindDn) {
        await client.bind(this.cfg.bindDn, this.cfg.bindPassword || '');
      }

      const filter = this.cfg.searchFilter.replace(
        /\{\{username\}\}/g,
        escapeLdapFilterValue(username)
      );

      const search = await client.search(this.cfg.searchBase, {
        scope: 'sub',
        filter,
        attributes: [
          'dn',
          this.cfg.emailAttr || 'mail',
          this.cfg.nameAttr || 'cn',
          'uid',
          'sAMAccountName',
          'userPrincipalName',
        ],
        sizeLimit: 1,
      });

      if (!search.searchEntries.length) {
        return { ok: false, reason: 'Invalid credentials' };
      }

      const entry = search.searchEntries[0];
      const userDn = String(entry.dn);

      // Bind as the user to prove password
      await client.bind(userDn, input.password);

      const emailAttr = this.cfg.emailAttr || 'mail';
      const nameAttr = this.cfg.nameAttr || 'cn';
      const emailRaw = entry[emailAttr];
      const nameRaw = entry[nameAttr];
      const email =
        (Array.isArray(emailRaw) ? String(emailRaw[0]) : emailRaw ? String(emailRaw) : '') ||
        `${username}@ldap.local`;
      const fullName =
        (Array.isArray(nameRaw) ? String(nameRaw[0]) : nameRaw ? String(nameRaw) : '') || username;

      const groups = await this.fetchGroups(client, userDn);
      const suggestedRole = mapGroupsToRole(
        groups,
        this.cfg.roleMap,
        this.cfg.defaultRole || UserRole.viewer
      );

      return {
        ok: true,
        identity: {
          username,
          email,
          fullName,
          externalId: userDn,
          groups,
          suggestedRole,
        },
      };
    } catch (e: any) {
      logger.warn(`LDAP authenticate failed for ${username}: ${e?.message || e}`);
      return { ok: false, reason: 'Invalid credentials' };
    } finally {
      try {
        await client.unbind();
      } catch {
        /* ignore */
      }
    }
  }

  private async fetchGroups(client: Client, userDn: string): Promise<string[]> {
    if (!this.cfg.groupBase || !this.cfg.groupFilter) {
      return [];
    }
    try {
      const filter = this.cfg.groupFilter.replace(/\{\{dn\}\}/g, escapeLdapFilterValue(userDn));
      const nameAttr = this.cfg.groupNameAttr || 'cn';
      const res = await client.search(this.cfg.groupBase, {
        scope: 'sub',
        filter,
        attributes: [nameAttr],
        sizeLimit: 200,
      });
      return res.searchEntries
        .map((e) => {
          const v = e[nameAttr];
          return Array.isArray(v) ? String(v[0]) : v ? String(v) : '';
        })
        .filter(Boolean);
    } catch (e: any) {
      logger.warn(`LDAP group lookup failed: ${e?.message || e}`);
      return [];
    }
  }
}
