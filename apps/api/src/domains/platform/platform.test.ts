import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { MemoryPlatformStore } from './platform';
import { createPlatformRouter } from './platform.routes';

vi.mock('../../middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user?: { userId: string; username: string; email: string; role: string } }).user = {
      userId: 'u1',
      username: 'admin',
      email: 'a@example.com',
      role: 'admin',
    };
    next();
  },
  authorize: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

describe('platform parity', () => {
  const store = new MemoryPlatformStore();
  store.signals.adminsWithoutMfa = ['root'];
  store.signals.nodes = [{ id: 'n1', name: 'edge', lastSeenAt: null }];
  const calls: string[] = [];
  const app = express();
  app.use(express.json());
  app.use(
    '/api/platform',
    createPlatformRouter(store, {
      authorizeSync: () => true,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response('{}', { status: 202 });
      },
    }),
  );
  store.listSyncNodes = async () => [{ id: 'n1', name: 'edge', host: '10.1.0.8', port: 3001, token: 'slave-key' }];

  it('creates a service account once, a runbook, and a violation', async () => {
    const created = await request(app).post('/api/platform/service-accounts').set('Authorization', 'Bearer test').send({ name: 'backup', role: 'viewer' });
    expect(created.status).toBe(201);
    expect(created.body.data.token.startsWith('nw_')).toBe(true);
    const listed = await request(app).get('/api/platform/service-accounts').set('Authorization', 'Bearer test');
    expect(JSON.stringify(listed.body)).not.toContain(created.body.data.token);
    const runbook = await request(app).post('/api/platform/runbooks').set('Authorization', 'Bearer test').send({ title: 'Failover', body: 'Promote the replica' });
    expect(runbook.status).toBe(201);
    const violations = await request(app).get('/api/platform/policies/violations').set('Authorization', 'Bearer test');
    expect(violations.body.data.some((item: { detail: string }) => item.detail.includes('MFA'))).toBe(true);
    expect(violations.body.data.some((item: { detail: string }) => item.detail.includes('heartbeat'))).toBe(true);
    const metrics = await request(app).get('/api/platform/metrics');
    expect(metrics.text).toContain('warden_up 1');
    const sync = await request(app).post('/api/platform/sync').set('Authorization', 'Bearer test');
    expect(sync.body.data[0].status).toBe(202);
    expect(calls[0]).toContain('/api/platform/sync/apply');
    const exported = await request(app).get('/api/platform/audit/export?format=csv').set('Authorization', 'Bearer test');
    expect(exported.headers['content-type']).toContain('text/csv');
  });
});
