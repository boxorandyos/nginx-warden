import jwt from 'jsonwebtoken';
import { AuthProviderType, AuthRequirementTarget } from '@prisma/client';
import { config } from '../../../config';
import prisma from '../../../config/database';
import {
  evaluateGroupRestrictions,
  resolvePolicy,
  getIdpForType,
} from './policy.service';
import { upsertExternalUser } from './jit-user.service';
import { authAbuseService, authAuditService } from './auth-audit-abuse.service';
import { AuthAuditOutcome } from '@prisma/client';
import { AuthenticationError, AuthorizationError, ValidationError } from '../../../shared/errors/app-error';
import { validateLdapConfig } from './provider-config.util';
import { LdapIdentityProvider } from './ldap.idp';

const GW_COOKIE = 'warden_gw';
const GW_TTL_SEC = 8 * 60 * 60;

export interface GatewaySessionPayload {
  typ: 'gateway';
  userId: string;
  username: string;
  domainId: string;
  host: string;
  groups: string[];
  providerType: AuthProviderType;
}

export function gatewayCookieName() {
  return GW_COOKIE;
}

export function signGatewaySession(payload: GatewaySessionPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: GW_TTL_SEC,
    audience: 'warden-gateway',
    issuer: 'nginx-warden',
  });
}

export function verifyGatewaySession(token: string): GatewaySessionPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      audience: 'warden-gateway',
      issuer: 'nginx-warden',
    }) as GatewaySessionPayload;
    if (decoded.typ !== 'gateway') return null;
    return decoded;
  } catch {
    return null;
  }
}

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    out[k] = v;
  }
  return out;
}

export class GatewayAuthService {
  async resolveDomainPolicy(host: string) {
    const hostname = host.split(':')[0].toLowerCase();
    const domain = await prisma.domain.findFirst({
      where: { name: hostname },
      select: { id: true, name: true, status: true },
    });
    if (!domain || domain.status !== 'active') {
      return null;
    }
    const policy = await resolvePolicy(AuthRequirementTarget.access_gateway, domain.id);
    if (!policy) return null;
    return { domain, policy };
  }

  async listProvidersForHost(host: string) {
    const resolved = await this.resolveDomainPolicy(host);
    if (!resolved) return { domain: null, policy: null, providers: [] as any[] };
    const providers = await prisma.authProviderConfig.findMany({
      where: {
        id: { in: resolved.policy.allowedProviderIds },
        enabled: true,
      },
      orderBy: { priority: 'asc' },
      select: { id: true, type: true, name: true, priority: true },
    });
    return { domain: resolved.domain, policy: resolved.policy, providers };
  }

  async verifyRequest(opts: {
    cookieHeader?: string;
    host?: string;
  }): Promise<{ ok: true; userId: string } | { ok: false }> {
    const host = (opts.host || '').split(':')[0].toLowerCase();
    const cookies = parseCookies(opts.cookieHeader);
    const token = cookies[GW_COOKIE];
    if (!token) return { ok: false };
    const session = verifyGatewaySession(token);
    if (!session) return { ok: false };
    if (session.host.toLowerCase() !== host) return { ok: false };

    const resolved = await this.resolveDomainPolicy(host);
    if (!resolved || resolved.domain.id !== session.domainId) return { ok: false };

    const groupCheck = evaluateGroupRestrictions(resolved.policy, session.groups);
    if (!groupCheck.allowed) return { ok: false };

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.status !== 'active') return { ok: false };

    return { ok: true, userId: user.id };
  }

  async passwordLogin(opts: {
    host: string;
    providerId: string;
    username: string;
    password: string;
    ip: string;
    userAgent: string;
  }): Promise<{ cookiePayload: GatewaySessionPayload }> {
    await authAbuseService.assertAllowed({ ip: opts.ip }).catch((e: any) => {
      throw new AuthenticationError(
        e.message === 'AUTH_CIRCUIT_OPEN'
          ? 'Authentication temporarily disabled'
          : 'Too many failed attempts'
      );
    });

    const resolved = await this.resolveDomainPolicy(opts.host);
    if (!resolved) throw new ValidationError('No access gateway policy for this host');

    const provider = await prisma.authProviderConfig.findUnique({
      where: { id: opts.providerId },
    });
    if (!provider || !provider.enabled) {
      throw new ValidationError('Identity provider not available');
    }
    if (!resolved.policy.allowedProviderIds.includes(provider.id)) {
      throw new AuthorizationError('Provider not allowed for this gateway');
    }

    if (provider.type === AuthProviderType.local) {
      const idp = getIdpForType(AuthProviderType.local)!;
      const result = await idp.authenticate({
        username: opts.username,
        password: opts.password,
      });
      if (!result.ok) {
        await this.fail(opts, resolved.policy.id, provider, null);
        throw new AuthenticationError('Invalid credentials');
      }
      const user = await prisma.user.findUnique({
        where: { username: result.identity.username },
      });
      if (!user) throw new AuthenticationError('Invalid credentials');
      const groupCheck = evaluateGroupRestrictions(resolved.policy, result.identity.groups);
      if (!groupCheck.allowed) {
        throw new AuthorizationError(groupCheck.reason || 'Group denied');
      }
      await this.succeedGateway(user, result.identity.groups, provider, resolved, opts);
      return {
        cookiePayload: {
          typ: 'gateway',
          userId: user.id,
          username: user.username,
          domainId: resolved.domain.id,
          host: resolved.domain.name,
          groups: result.identity.groups,
          providerType: provider.type,
        },
      };
    }

    if (provider.type === AuthProviderType.ldap) {
      const cfg = validateLdapConfig((provider.config as any) || {});
      const idp = new LdapIdentityProvider(cfg);
      const result = await idp.authenticate({
        username: opts.username,
        password: opts.password,
      });
      if (!result.ok) {
        await this.fail(opts, resolved.policy.id, provider, null);
        throw new AuthenticationError('Invalid credentials');
      }
      const user = await upsertExternalUser(AuthProviderType.ldap, result.identity);
      const groupCheck = evaluateGroupRestrictions(resolved.policy, result.identity.groups);
      if (!groupCheck.allowed) {
        throw new AuthorizationError(groupCheck.reason || 'Group denied');
      }
      await this.succeedGateway(user, result.identity.groups, provider, resolved, opts);
      return {
        cookiePayload: {
          typ: 'gateway',
          userId: user.id,
          username: user.username,
          domainId: resolved.domain.id,
          host: resolved.domain.name,
          groups: result.identity.groups,
          providerType: provider.type,
        },
      };
    }

    throw new ValidationError('This provider requires OIDC browser login');
  }

  private async fail(
    opts: { ip: string; userAgent: string; username: string },
    policyId: string,
    provider: { id: string; type: AuthProviderType },
    userId: string | null
  ) {
    await authAbuseService.recordFailure({
      userId,
      ip: opts.ip,
      username: opts.username,
    });
    await authAuditService.write({
      outcome: AuthAuditOutcome.failure,
      message: 'Gateway login failed',
      ip: opts.ip,
      userAgent: opts.userAgent,
      username: opts.username,
      userId,
      policyId,
      providerId: provider.id,
      providerType: provider.type,
    });
  }

  private async succeedGateway(
    user: { id: string; username: string },
    groups: string[],
    provider: { id: string; type: AuthProviderType },
    resolved: { domain: { id: string; name: string }; policy: { id: string } },
    opts: { host: string; ip: string; userAgent: string }
  ) {
    await authAbuseService.recordSuccess({ userId: user.id, ip: opts.ip });
    await authAuditService.write({
      outcome: AuthAuditOutcome.success,
      message: 'Gateway login succeeded',
      ip: opts.ip,
      userAgent: opts.userAgent,
      username: user.username,
      userId: user.id,
      policyId: resolved.policy.id,
      providerId: provider.id,
      providerType: provider.type,
      details: { host: opts.host, domainId: resolved.domain.id },
    });
  }

  buildSessionCookie(payload: GatewaySessionPayload, secure: boolean): string {
    const token = signGatewaySession(payload);
    const parts = [
      `${GW_COOKIE}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${GW_TTL_SEC}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  }
}

export const gatewayAuthService = new GatewayAuthService();

export function renderGatewayLoginHtml(opts: {
  host: string;
  rd: string;
  providers: Array<{ id: string; type: string; name: string }>;
  error?: string;
}): string {
  const passwordProviders = opts.providers.filter(
    (p) => p.type === 'local' || p.type === 'ldap'
  );
  const oidcProviders = opts.providers.filter(
    (p) => p.type === 'oidc_entra' || p.type === 'oidc_generic'
  );

  const pwdOptions = passwordProviders
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');

  const oidcButtons = oidcProviders
    .map(
      (p) =>
        `<a class="btn oidc" href="/_warden/oidc/start?providerId=${encodeURIComponent(p.id)}&rd=${encodeURIComponent(opts.rd)}">${escapeHtml(p.name)}</a>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in — ${escapeHtml(opts.host)}</title>
  <style>
    :root { color-scheme: light dark; --bg:#0f1419; --card:#1a222c; --fg:#e8eef5; --muted:#9aa8b5; --accent:#3d9b8f; --err:#d45; }
    body { margin:0; min-height:100vh; font-family: ui-sans-serif, system-ui, sans-serif; background: radial-gradient(1200px 600px at 20% -10%, #1e3a36, var(--bg)); color: var(--fg); display:flex; align-items:center; justify-content:center; padding:1.5rem; }
    .card { width:100%; max-width:420px; background:var(--card); border-radius:12px; padding:1.75rem; box-shadow:0 20px 50px rgba(0,0,0,.35); }
    h1 { font-size:1.25rem; margin:0 0 .35rem; }
    p { color:var(--muted); margin:0 0 1.25rem; font-size:.9rem; }
    label { display:block; font-size:.8rem; margin:.75rem 0 .35rem; color:var(--muted); }
    input, select { width:100%; box-sizing:border-box; padding:.65rem .75rem; border-radius:8px; border:1px solid #2c3a47; background:#121820; color:var(--fg); }
    .btn { display:inline-flex; justify-content:center; width:100%; margin-top:1rem; padding:.7rem 1rem; border:0; border-radius:8px; background:var(--accent); color:#04120f; font-weight:600; cursor:pointer; text-decoration:none; }
    .btn.oidc { background:#243040; color:var(--fg); margin-top:.5rem; }
    .err { background:#3a1818; color:#ffb4b4; padding:.6rem .75rem; border-radius:8px; margin-bottom:1rem; font-size:.85rem; }
    .divider { text-align:center; color:var(--muted); margin:1.25rem 0 .5rem; font-size:.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication required</h1>
    <p>Sign in to continue to <strong>${escapeHtml(opts.host)}</strong></p>
    ${opts.error ? `<div class="err">${escapeHtml(opts.error)}</div>` : ''}
    ${
      passwordProviders.length
        ? `<form method="POST" action="/_warden/login">
      <input type="hidden" name="rd" value="${escapeHtml(opts.rd)}" />
      <label>Identity provider</label>
      <select name="providerId" required>${pwdOptions}</select>
      <label>Username</label>
      <input name="username" autocomplete="username" required />
      <label>Password</label>
      <input name="password" type="password" autocomplete="current-password" required />
      <button class="btn" type="submit">Sign in</button>
    </form>`
        : ''
    }
    ${oidcProviders.length ? `<div class="divider">or continue with</div>${oidcButtons}` : ''}
    ${
      !passwordProviders.length && !oidcProviders.length
        ? `<p>No identity providers are enabled for this gateway. Contact an administrator.</p>`
        : ''
    }
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
