import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { rejectUnknownBodyKeys } from '../request-shape';

describe('rejectUnknownBodyKeys', () => {
  const app = express();
  app.use(express.json());
  app.post('/t', rejectUnknownBodyKeys(['username', 'password']), (_req, res) => {
    res.json({ ok: true });
  });

  it('accepts allowed fields', async () => {
    const response = await request(app).post('/t').send({ username: 'a', password: 'b' });
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('rejects unknown fields', async () => {
    const response = await request(app)
      .post('/t')
      .send({ username: 'a', password: 'b', extra: true });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Unknown fields');
  });
});
