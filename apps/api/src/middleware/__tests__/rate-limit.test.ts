import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { rateLimit } from '../rate-limit';

describe('rateLimit', () => {
  it('returns 429 after limit reached', async () => {
    const app = express();
    app.get(
      '/limited',
      rateLimit({ keyPrefix: 'test-limit', windowMs: 60_000, max: 2 }),
      (_req, res) => {
        res.status(200).json({ ok: true });
      }
    );

    const first = await request(app).get('/limited');
    const second = await request(app).get('/limited');
    const third = await request(app).get('/limited');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.header['retry-after']).toBeDefined();
  });
});
