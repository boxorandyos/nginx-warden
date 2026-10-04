import { Router, Request, Response } from 'express';
import {
  gatewayAuthService,
  gatewayCookieName,
  renderGatewayLoginHtml,
  type GatewaySessionPayload,
} from './services/gateway.service';
import { oidcAuthService } from './services/oidc.service';
import { upsertExternalUser } from './services/jit-user.service';
import { evaluateGroupRestrictions } from './services/group-policy.util';
import { authAuditService } from './services/auth-audit-abuse.service';
import { AuthAuditOutcome } from '@prisma/client';
import logger from '../../utils/logger';

const router = Router();

function clientMeta(req: Request) {
  return {
    ip: (req.headers['x-real-ip'] as string) || req.ip || '0.0.0.0',
    userAgent: req.headers['user-agent'] || 'unknown',
  };
}

function hostFromReq(req: Request): string {
  return String(req.headers['x-forwarded-host'] || req.headers['x-original-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();
}

/** nginx auth_request target — 200 allow, 401 deny */
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const host = hostFromReq(req);
    const result = await gatewayAuthService.verifyRequest({
      cookieHeader: req.headers.cookie,
      host,
    });
    if (!result.ok) {
      res.status(401).end();
      return;
    }
    res.setHeader('X-Warden-User', result.userId);
    res.status(200).end();
  } catch (e) {
    logger.error('gateway verify', e);
    res.status(401).end();
  }
});

router.get('/login', async (req: Request, res: Response) => {
  const host = hostFromReq(req);
  const rd = String(req.query.rd || `https://${host}/`);
  const { providers } = await gatewayAuthService.listProvidersForHost(host);
  const html = renderGatewayLoginHtml({
    host,
    rd,
    providers,
    error: req.query.error ? String(req.query.error) : undefined,
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

router.post('/login', async (req: Request, res: Response) => {
  const host = hostFromReq(req);
  const meta = clientMeta(req);
  const rd = String(req.body?.rd || req.query.rd || `https://${host}/`);
  const providerId = String(req.body?.providerId || '');
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  try {
    const { cookiePayload } = await gatewayAuthService.passwordLogin({
      host,
      providerId,
      username,
      password,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const secure = (req.headers['x-forwarded-proto'] || 'https') === 'https';
    res.setHeader('Set-Cookie', gatewayAuthService.buildSessionCookie(cookiePayload, secure));
    res.redirect(302, rd.startsWith('http') ? rd : `https://${host}/`);
  } catch (e: any) {
    logger.warn(`gateway login failed: ${e.message}`);
    const q = new URLSearchParams({
      rd,
      error: e.message || 'Login failed',
    });
    res.redirect(302, `/_warden/login?${q.toString()}`);
  }
});

router.get('/oidc/start', async (req: Request, res: Response) => {
  try {
    const host = hostFromReq(req);
    const providerId = String(req.query.providerId || '');
    const rd = String(req.query.rd || `https://${host}/`);
    const resolved = await gatewayAuthService.resolveDomainPolicy(host);
    if (!resolved) {
      res.status(400).send('No gateway policy');
      return;
    }
    if (!resolved.policy.allowedProviderIds.includes(providerId)) {
      res.status(403).send('Provider not allowed');
      return;
    }
    const proto = String(req.headers['x-forwarded-proto'] || 'https');
    const redirectUri = `${proto}://${host}/_warden/oidc/callback`;
    const { url } = await oidcAuthService.start({
      providerId,
      redirectUri,
      returnTo: rd,
      host,
      purpose: 'access_gateway',
      domainId: resolved.domain.id,
    });
    res.redirect(302, url);
  } catch (e: any) {
    res.redirect(302, `/_warden/login?error=${encodeURIComponent(e.message || 'OIDC start failed')}`);
  }
});

router.get('/oidc/callback', async (req: Request, res: Response) => {
  try {
    const host = hostFromReq(req);
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    if (!state || !code) throw new Error('Missing OIDC code/state');

    const finished = await oidcAuthService.finish({ state, code });
    const user = await upsertExternalUser(finished.providerType, finished.identity);

    const resolved = await gatewayAuthService.resolveDomainPolicy(host);
    if (!resolved) throw new Error('No gateway policy');

    const groupCheck = evaluateGroupRestrictions(resolved.policy, finished.identity.groups);
    if (!groupCheck.allowed) throw new Error(groupCheck.reason || 'Group denied');

    const meta = clientMeta(req);
    await authAuditService.write({
      outcome: AuthAuditOutcome.success,
      message: 'Gateway OIDC login succeeded',
      ip: meta.ip,
      userAgent: meta.userAgent,
      username: user.username,
      userId: user.id,
      policyId: resolved.policy.id,
      providerId: finished.providerId,
      providerType: finished.providerType,
    });

    const payload: GatewaySessionPayload = {
      typ: 'gateway',
      userId: user.id,
      username: user.username,
      domainId: resolved.domain.id,
      host: resolved.domain.name,
      groups: finished.identity.groups,
      providerType: finished.providerType,
    };
    const secure = (req.headers['x-forwarded-proto'] || 'https') === 'https';
    res.setHeader('Set-Cookie', gatewayAuthService.buildSessionCookie(payload, secure));
    res.redirect(302, finished.returnTo || `https://${host}/`);
  } catch (e: any) {
    logger.warn(`gateway oidc callback failed: ${e.message}`);
    res.redirect(302, `/_warden/login?error=${encodeURIComponent(e.message || 'OIDC failed')}`);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const secure = (req.headers['x-forwarded-proto'] || 'https') === 'https';
  const host = hostFromReq(req);
  res.setHeader(
    'Set-Cookie',
    `${gatewayCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
  );
  res.redirect(302, `/_warden/login?rd=${encodeURIComponent(`https://${host}/`)}`);
});

export default router;
