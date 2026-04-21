import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import axios from 'axios';
import logger from '../../utils/logger';

const execFileAsync = promisify(execFile);

export type CrowdsecStatusPayload = {
  cscliOnPath: boolean;
  version?: string;
  bouncersList?: string;
  metricsSnippet?: string;
  lapi?: {
    url: string;
    ok: boolean;
    statusCode?: number;
    error?: string;
  };
  hint?: string;
};

/**
 * Best-effort CrowdSec visibility: cscli when installed, optional LAPI check with API key.
 * Does not install or configure CrowdSec.
 */
export async function getCrowdsecStatus(): Promise<CrowdsecStatusPayload> {
  const payload: CrowdsecStatusPayload = { cscliOnPath: false };

  try {
    const v = await execFileAsync('cscli', ['version'], { timeout: 8000, maxBuffer: 256 * 1024 });
    payload.cscliOnPath = true;
    payload.version = v.stdout.trim().slice(0, 4000);
  } catch {
    payload.hint =
      'CrowdSec Security Engine is not installed or cscli is not on PATH. On Debian/Ubuntu run scripts/install-crowdsec.sh (see docs).';
    return payload;
  }

  try {
    const b = await execFileAsync('cscli', ['bouncers', 'list', '-o', 'raw'], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    }).catch(() => execFileAsync('cscli', ['bouncers', 'list'], { timeout: 15000, maxBuffer: 1024 * 1024 }));
    payload.bouncersList = b.stdout.slice(0, 12000);
  } catch (e) {
    logger.warn('cscli bouncers list failed', e);
    payload.bouncersList = e instanceof Error ? e.message : String(e);
  }

  try {
    const m = await execFileAsync('cscli', ['metrics', '-o', 'human'], { timeout: 12000, maxBuffer: 2 * 1024 * 1024 });
    payload.metricsSnippet = m.stdout.slice(0, 16000);
  } catch {
    try {
      const m2 = await execFileAsync('cscli', ['metrics'], { timeout: 12000, maxBuffer: 2 * 1024 * 1024 });
      payload.metricsSnippet = m2.stdout.slice(0, 16000);
    } catch (e) {
      logger.warn('cscli metrics failed', e);
    }
  }

  const lapiUrl = (process.env.CROWDSEC_LAPI_URL || 'http://127.0.0.1:9091').replace(/\/$/, '');
  const apiKey = process.env.CROWDSEC_API_KEY?.trim();
  if (apiKey) {
    try {
      const r = await axios.get(`${lapiUrl}/v1/decisions`, {
        headers: { 'X-Api-Key': apiKey },
        params: { limit: 1 },
        timeout: 8000,
        validateStatus: () => true,
      });
      payload.lapi = {
        url: lapiUrl,
        ok: r.status === 200,
        statusCode: r.status,
        error: r.status !== 200 ? `HTTP ${r.status}` : undefined,
      };
    } catch (e) {
      payload.lapi = {
        url: lapiUrl,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  } else {
    payload.hint =
      'Set CROWDSEC_API_KEY (and optionally CROWDSEC_LAPI_URL) in apps/api/.env to verify Local API from the UI. scripts/install-crowdsec.sh uses LAPI on 127.0.0.1:9091 by default (CROWDSEC_LAPI_PORT).';
  }

  return payload;
}

export type CrowdsecDecisionsPayload = {
  ok: boolean;
  decisions?: unknown;
  error?: string;
};

/** Sample active decisions from LAPI (requires CROWDSEC_API_KEY). */
export async function getCrowdsecDecisionsPreview(): Promise<CrowdsecDecisionsPayload> {
  const apiKey = process.env.CROWDSEC_API_KEY?.trim();
  const lapiUrl = (process.env.CROWDSEC_LAPI_URL || 'http://127.0.0.1:9091').replace(/\/$/, '');
  if (!apiKey) {
    return { ok: false, error: 'CROWDSEC_API_KEY is not set' };
  }
  try {
    const r = await axios.get(`${lapiUrl}/v1/decisions`, {
      headers: { 'X-Api-Key': apiKey },
      params: { limit: 100 },
      timeout: 15000,
      validateStatus: () => true,
    });
    if (r.status !== 200) {
      return { ok: false, error: `LAPI HTTP ${r.status}` };
    }
    return { ok: true, decisions: r.data };
  } catch (e) {
    logger.warn('getCrowdsecDecisionsPreview failed', e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
