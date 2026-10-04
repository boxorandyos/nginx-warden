import { Issuer, generators, Client } from 'openid-client';
import { AuthProviderType, UserRole } from '@prisma/client';
import prisma from '../../../config/database';
import {
  mapGroupsToRole,
  validateOidcConfig,
  type OidcProviderConfig,
} from './provider-config.util';
import type { IdpIdentity } from '../identity.types';
import { ValidationError } from '../../../shared/errors/app-error';
import logger from '../../../utils/logger';

const pendingStates = new Map<
  string,
  {
    providerId: string;
    codeVerifier: string;
    nonce: string;
    redirectUri: string;
    returnTo: string;
    host: string;
    purpose: 'admin_portal' | 'access_gateway';
    domainId?: string;
    expiresAt: number;
  }
>();

// Cleanup expired OIDC states periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (v.expiresAt < now) pendingStates.delete(k);
  }
}, 60_000).unref?.();

async function getClient(cfg: OidcProviderConfig, redirectUri: string): Promise<Client> {
  const issuer = await Issuer.discover(cfg.issuer);
  return new issuer.Client({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uris: [redirectUri],
    response_types: ['code'],
  });
}

function claimString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  if (Array.isArray(v)) return String(v[0] || '');
  if (v == null) return '';
  return String(v);
}

function claimGroups(payload: Record<string, unknown>, key: string): string[] {
  const v = payload[key];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v) return [v];
  return [];
}

export class OidcAuthService {
  async start(opts: {
    providerId: string;
    redirectUri: string;
    returnTo: string;
    host: string;
    purpose: 'admin_portal' | 'access_gateway';
    domainId?: string;
  }): Promise<{ url: string }> {
    const provider = await prisma.authProviderConfig.findUnique({ where: { id: opts.providerId } });
    if (!provider || !provider.enabled) {
      throw new ValidationError('OIDC provider is not available');
    }
    if (
      provider.type !== AuthProviderType.oidc_entra &&
      provider.type !== AuthProviderType.oidc_generic
    ) {
      throw new ValidationError('Provider is not an OIDC IdP');
    }

    const cfg = validateOidcConfig(provider.type, (provider.config as any) || {});
    if (!cfg.clientSecret) {
      throw new ValidationError('OIDC client secret is not configured');
    }

    const client = await getClient(cfg, opts.redirectUri);
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    pendingStates.set(state, {
      providerId: provider.id,
      codeVerifier,
      nonce,
      redirectUri: opts.redirectUri,
      returnTo: opts.returnTo,
      host: opts.host,
      purpose: opts.purpose,
      domainId: opts.domainId,
      expiresAt: Date.now() + 10 * 60_000,
    });

    const url = client.authorizationUrl({
      scope: cfg.scopes || 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return { url };
  }

  async finish(opts: {
    state: string;
    code: string;
  }): Promise<{
    identity: IdpIdentity;
    providerType: AuthProviderType;
    providerId: string;
    returnTo: string;
    host: string;
    purpose: 'admin_portal' | 'access_gateway';
    domainId?: string;
  }> {
    const pending = pendingStates.get(opts.state);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingStates.delete(opts.state);
      throw new ValidationError('OIDC state expired or invalid — start login again');
    }
    pendingStates.delete(opts.state);

    const provider = await prisma.authProviderConfig.findUnique({
      where: { id: pending.providerId },
    });
    if (!provider) throw new ValidationError('OIDC provider not found');

    const cfg = validateOidcConfig(provider.type, (provider.config as any) || {});
    const client = await getClient(cfg, pending.redirectUri);

    const tokenSet = await client.callback(
      pending.redirectUri,
      { code: opts.code, state: opts.state },
      { code_verifier: pending.codeVerifier, state: opts.state, nonce: pending.nonce }
    );

    const claims = (tokenSet.claims() || {}) as Record<string, unknown>;
    const email =
      claimString(claims, cfg.emailClaim || 'email') ||
      claimString(claims, 'preferred_username') ||
      `${claimString(claims, 'sub') || 'user'}@oidc.local`;
    const fullName =
      claimString(claims, cfg.nameClaim || 'name') ||
      claimString(claims, 'preferred_username') ||
      email.split('@')[0];
    const username =
      claimString(claims, 'preferred_username').split('@')[0] ||
      email.split('@')[0] ||
      claimString(claims, 'sub').slice(0, 32);
    const groups = claimGroups(claims, cfg.groupClaim || 'groups');
    const suggestedRole = mapGroupsToRole(
      groups,
      cfg.roleMap,
      cfg.defaultRole || UserRole.viewer
    );

    logger.info(`OIDC login ok provider=${provider.name} sub=${claimString(claims, 'sub')}`);

    return {
      identity: {
        username,
        email,
        fullName,
        externalId: claimString(claims, 'sub') || email,
        groups,
        suggestedRole,
      },
      providerType: provider.type,
      providerId: provider.id,
      returnTo: pending.returnTo,
      host: pending.host,
      purpose: pending.purpose,
      domainId: pending.domainId,
    };
  }
}

export const oidcAuthService = new OidcAuthService();
