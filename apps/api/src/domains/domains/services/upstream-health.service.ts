import http from 'node:http';
import https from 'node:https';
import logger from '../../../utils/logger';
import { DomainWithRelations } from '../domains.types';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * HTTP(S) upstream health probes for load-balancer settings.
 */
export class UpstreamHealthService {
  /**
   * Probe all upstreams for a domain when health checks are enabled.
   */
  async checkUpstreamsHealth(domain: DomainWithRelations): Promise<void> {
    if (!domain.loadBalancer?.healthCheckEnabled) {
      return;
    }
    const path = domain.loadBalancer.healthCheckPath || '/';
    for (const u of domain.upstreams) {
      const ok = await this.checkUpstreamHealth(u.host, u.port, u.protocol || 'http', path, u.sslVerify !== false);
      logger.info(`Health ${ok ? 'OK' : 'FAIL'} ${domain.name} → ${u.protocol || 'http'}://${u.host}:${u.port}${path}`);
    }
  }

  /**
   * GET healthCheckPath on an upstream; success = HTTP 2xx or 3xx.
   */
  async checkUpstreamHealth(
    host: string,
    port: number,
    protocol: string,
    healthCheckPath: string,
    verifyTls: boolean = true
  ): Promise<boolean> {
    const path = healthCheckPath.startsWith('/') ? healthCheckPath : `/${healthCheckPath}`;
    const useTls = protocol === 'https';

    return new Promise((resolve) => {
      const lib = useTls ? https : http;
      const req = lib.request(
        {
          hostname: host,
          port,
          path,
          method: 'GET',
          timeout: DEFAULT_TIMEOUT_MS,
          ...(useTls ? { rejectUnauthorized: verifyTls } : {}),
        },
        (res) => {
          const code = res.statusCode ?? 0;
          const ok = code >= 200 && code < 400;
          res.resume();
          resolve(ok);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }
}

export const upstreamHealthService = new UpstreamHealthService();
