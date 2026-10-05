import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate, authorize, type AuthRequest } from '../../middleware/auth';
import { readSystemUpdateLogTail } from '../system/system-update.service';
import { prometheusText, type MemoryPlatformStore } from './platform';
import { platformStore } from './prisma-store';

type Store = MemoryPlatformStore & {
  heartbeat?(token: string): Promise<boolean> | boolean;
  listSyncNodes?(): Promise<Array<{ id: string; name: string; host: string; port: number; token: string }>>;
};

export function createPlatformRouter(
  store: Store,
  options?: { fetchImpl?: typeof fetch; nodeRole?: string; authorizeSync?: (key: string) => boolean | Promise<boolean> },
): Router {
  const router = Router();
  const fetchImpl = options?.fetchImpl ?? fetch;

  router.post('/heartbeat', async (req, res) => {
    const key = String(req.header('x-api-key') ?? '');
    const ok = store.heartbeat ? await store.heartbeat(key) : false;
    if (!ok) {
      res.status(401).json({ success: false, message: 'invalid api key' });
      return;
    }
    res.json({ success: true });
  });

  router.post('/sync/apply', async (req, res, next) => {
    try {
      const key = String(req.header('x-api-key') ?? '');
      const allowed = options?.authorizeSync ? await options.authorizeSync(key) : false;
      if (!allowed) {
        res.status(401).json({ success: false, message: 'invalid api key' });
        return;
      }
      await store.applyDocument(req.body ?? {});
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/metrics', async (_req, res, next) => {
    try {
      const sample = await store.metrics();
      res.type('text/plain; version=0.0.4').send(prometheusText(sample));
    } catch (error) {
      next(error);
    }
  });

  router.use(authenticate);

  router.get('/environments', guard, async (_req, res, next) => {
    try {
      res.json({ success: true, data: await store.listEnvironments() });
    } catch (error) {
      next(error);
    }
  });
  router.post('/environments', authorize('admin'), async (req, res, next) => {
    try {
      res.status(201).json({ success: true, data: await store.createEnvironment(req.body ?? {}) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/service-accounts', authorize('admin'), async (_req, res, next) => {
    try {
      res.json({ success: true, data: await store.listAccounts() });
    } catch (error) {
      next(error);
    }
  });
  router.post('/service-accounts', authorize('admin'), async (req, res, next) => {
    try {
      const account = await store.createAccount(req.body ?? {});
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  });
  router.delete('/service-accounts/:id', authorize('admin'), async (req, res, next) => {
    try {
      await store.deleteAccount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  router.get('/jobs', async (_req, res, next) => {
    try {
      res.json({ success: true, data: await store.listJobs() });
    } catch (error) {
      next(error);
    }
  });
  router.get('/runbooks', async (req, res, next) => {
    try {
      res.json({ success: true, data: await store.listRunbooks(environmentOf(req)) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/runbooks', authorize('admin', 'moderator'), async (req, res, next) => {
    try {
      res.status(201).json({ success: true, data: await store.createRunbook({ ...req.body, environmentId: pinned(req, req.body?.environmentId) }) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/alert-rules', async (_req, res, next) => {
    try {
      res.json({ success: true, data: await store.listRules() });
    } catch (error) {
      next(error);
    }
  });
  router.post('/alert-rules', authorize('admin', 'moderator'), async (req, res, next) => {
    try {
      res.status(201).json({ success: true, data: await store.createRule(req.body ?? {}) });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/alert-rules/:id', authorize('admin', 'moderator'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await store.setRuleEnabled(req.params.id, Boolean(req.body?.enabled)) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/policies', async (_req, res, next) => {
    try {
      res.json({ success: true, data: await store.listPolicies() });
    } catch (error) {
      next(error);
    }
  });
  router.post('/policies', authorize('admin'), async (req, res, next) => {
    try {
      res.status(201).json({ success: true, data: await store.createPolicy(req.body ?? {}) });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/policies/:id', authorize('admin'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await store.setPolicyEnabled(req.params.id, Boolean(req.body?.enabled)) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/policies/violations', async (_req, res, next) => {
    try {
      await store.addJob('policy.evaluate', 'operator');
      res.json({ success: true, data: await store.violations() });
    } catch (error) {
      next(error);
    }
  });
  router.get('/audit/export', authorize('admin'), async (req, res, next) => {
    try {
      const rows = await store.exportAudit();
      if (req.query.format === 'csv') {
        const header = 'actor,action,detail,createdAt';
        const lines = rows.map((row) => [row.actor ?? '', row.action, row.detail ?? '', row.createdAt].map(csv).join(','));
        res.type('text/csv').send([header, ...lines].join('\n'));
        return;
      }
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });
  router.get('/snapshots', authorize('admin'), async (_req, res, next) => {
    try {
      res.json({ success: true, data: await store.listSnapshots() });
    } catch (error) {
      next(error);
    }
  });
  router.post('/snapshots', authorize('admin'), async (req: AuthRequest, res, next) => {
    try {
      res.status(201).json({ success: true, data: await store.createSnapshot(req.user?.username || 'admin') });
    } catch (error) {
      next(error);
    }
  });
  router.post('/snapshots/:id/apply', authorize('admin'), async (req, res, next) => {
    try {
      await store.applySnapshot(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  router.get('/logs', authorize('admin'), async (_req, res, next) => {
    try {
      res.json({ success: true, data: await readSystemUpdateLogTail() });
    } catch (error) {
      next(error);
    }
  });
  router.post('/sync', authorize('admin'), async (req, res, next) => {
    try {
      if (options?.nodeRole === 'slave') {
        res.status(403).json({ success: false, message: 'A slave cannot push platform configuration' });
        return;
      }
      const document = await store.document();
      const nodes = (await store.listSyncNodes?.()) ?? [];
      const results = [];
      for (const node of nodes) {
        const url = `http://${node.host}:${node.port}/api/platform/sync/apply`;
        try {
          const response = await fetchImpl(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': node.token },
            body: JSON.stringify(document),
          });
          results.push({ id: node.id, name: node.name, status: response.status });
        } catch (error) {
          results.push({ id: node.id, name: node.name, status: 0, message: error instanceof Error ? error.message : 'sync failed' });
        }
      }
      await store.addJob('platform.sync', 'admin');
      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  });

  router.use((error: { status?: number; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Platform request failed' });
  });
  return router;

  function guard(req: AuthRequest, res: Response, next: NextFunction) {
    const pinnedId = (req.user as { environmentId?: string | null } | undefined)?.environmentId;
    const requested = String(req.query.environmentId ?? '');
    if (pinnedId && requested && requested !== pinnedId) {
      res.status(403).json({ success: false, message: 'Service account is pinned to another environment' });
      return;
    }
    next();
  }

  function environmentOf(req: AuthRequest): string | undefined {
    const pinnedId = (req.user as { environmentId?: string | null } | undefined)?.environmentId;
    return pinnedId || (req.query.environmentId ? String(req.query.environmentId) : undefined);
  }

  function pinned(req: AuthRequest, requested?: string | null): string | null {
    const pinnedId = (req.user as { environmentId?: string | null } | undefined)?.environmentId;
    if (pinnedId && requested && requested !== pinnedId) {
      throw Object.assign(new Error('Service account is pinned to another environment'), { status: 403 });
    }
    return pinnedId || requested || null;
  }
}

function csv(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const router = createPlatformRouter(platformStore as unknown as Store, {
  authorizeSync: async (key) => {
    const { maintenanceKeyMatches } = await import('../system/maintenance');
    const prisma = (await import('../../config/database')).default;
    const config = await prisma.systemConfig.findFirst();
    return maintenanceKeyMatches(config?.masterApiKey ?? undefined, key);
  },
});
export default router;
