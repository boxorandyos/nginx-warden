import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { identityController } from './identity.controller';
import gatewayRoutes from './gateway.routes';
import { resolvePolicy } from './services/policy.service';
import { AuthRequirementTarget } from '@prisma/client';
import prisma from '../../config/database';
import { oidcAuthService } from './services/oidc.service';
import { upsertExternalUser } from './services/jit-user.service';
import { evaluateGroupRestrictions } from './services/group-policy.util';
import { AuthService } from '../auth/auth.service';
import { AuthRepository } from '../auth/auth.repository';
import { authAuditService } from './services/auth-audit-abuse.service';
import { AuthAuditOutcome } from '@prisma/client';

const router = Router();
const authService = new AuthService(new AuthRepository());

// Public: access gateway (proxied via /_warden/ on protected domains)
router.use('/gateway', gatewayRoutes);

/** Public: IdPs allowed for admin portal login UI */
router.get('/login-providers', async (_req, res) => {
  try {
    const policy = await resolvePolicy(AuthRequirementTarget.admin_portal);
    if (!policy) {
      res.json({ success: true, data: [] });
      return;
    }
    const providers = await prisma.authProviderConfig.findMany({
      where: { id: { in: policy.allowedProviderIds }, enabled: true },
      orderBy: { priority: 'asc' },
      select: { id: true, type: true, name: true },
    });
    res.json({ success: true, data: providers });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

/** Public: start OIDC for admin portal */
router.get('/oidc/:providerId/start', async (req, res) => {
  try {
    const providerId = req.params.providerId;
    const policy = await resolvePolicy(AuthRequirementTarget.admin_portal);
    if (!policy?.allowedProviderIds.includes(providerId)) {
      res.status(403).json({ success: false, message: 'Provider not allowed' });
      return;
    }
    const returnTo = String(req.query.returnTo || '/dashboard');
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https');
    const redirectUri = `${proto}://${host}/api/identity/oidc/callback`;
    const { url } = await oidcAuthService.start({
      providerId,
      redirectUri,
      returnTo,
      host,
      purpose: 'admin_portal',
    });
    res.redirect(302, url);
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
});

router.get('/oidc/callback', async (req, res) => {
  try {
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    const finished = await oidcAuthService.finish({ state, code });
    const user = await upsertExternalUser(finished.providerType, finished.identity);
    const policy = await resolvePolicy(AuthRequirementTarget.admin_portal);
    if (!policy) throw new Error('No admin portal policy');
    const groupCheck = evaluateGroupRestrictions(policy, finished.identity.groups);
    if (!groupCheck.allowed) throw new Error(groupCheck.reason || 'Group denied');

    const metadata = {
      ip: (req.headers['x-real-ip'] as string) || req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };
    await authAuditService.write({
      outcome: AuthAuditOutcome.success,
      message: 'Admin portal OIDC login succeeded',
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      username: user.username,
      userId: user.id,
      policyId: policy.id,
      providerId: finished.providerId,
      providerType: finished.providerType,
    });

    const full = await new AuthRepository().findUserById(user.id);
    if (!full) throw new Error('User missing');
    const tokens = await authService.completeLoginPublic(full, metadata);

    const html = `<!DOCTYPE html><html><body><script>
localStorage.setItem('accessToken', ${JSON.stringify(tokens.accessToken)});
localStorage.setItem('refreshToken', ${JSON.stringify(tokens.refreshToken)});
localStorage.setItem('user', ${JSON.stringify(JSON.stringify(tokens.user))});
location.replace(${JSON.stringify(finished.returnTo.startsWith('/') ? finished.returnTo : '/dashboard')});
</script><p>Signing you in…</p></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (e: any) {
    res.redirect(302, `/login?error=${encodeURIComponent(e.message || 'OIDC failed')}`);
  }
});

router.use(authenticate, authorize('admin'));

router.get('/providers', (req, res) => identityController.listProviders(req, res));
router.patch('/providers/:id', (req, res) => identityController.updateProvider(req, res));

router.get('/policies', (req, res) => identityController.listPolicies(req, res));
router.patch('/policies/:id', (req, res) => identityController.updatePolicy(req, res));
router.post('/policies/gateway', (req, res) => identityController.createGatewayPolicy(req, res));

router.get('/audit-logs', (req, res) => identityController.listAuditLogs(req, res));

router.get('/abuse/settings', (req, res) => identityController.getAbuseSettings(req, res));
router.put('/abuse/settings', (req, res) => identityController.updateAbuseSettings(req, res));
router.get('/abuse/states', (req, res) => identityController.listAbuseStates(req, res));
router.delete('/abuse/states/:key', (req, res) => identityController.clearAbuseState(req, res));

export default router;
