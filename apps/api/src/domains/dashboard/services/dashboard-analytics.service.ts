/**
 * Dashboard Analytics Service
 * Handles advanced analytics and statistics from logs
 *
 * IMPORTANT: Log reads must be bounded (tail + timeout). Unbounded `grep` of full
 * error/access logs across every domain stalls the Node process and causes the UI
 * to show Axios "Network Error" (blank status) on dashboard widgets.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import logger from '../../../utils/logger';
import {
  RequestTrendDataPoint,
  SlowRequestEntry,
  AttackTypeStats,
  LatestAttackEntry,
  IpAnalyticsEntry,
  AttackRatioStats,
  RequestAnalyticsResponse,
} from '../types/dashboard-analytics.types';
import { parseAccessLogLine, parseModSecLogLine } from '../../logs/services/log-parser.service';

const execFileAsync = promisify(execFile);

const NGINX_ACCESS_LOG = '/var/log/nginx/access.log';
const NGINX_ERROR_LOG = '/var/log/nginx/error.log';
const NGINX_LOG_DIR = '/var/log/nginx';

/** Cap stdout from shell helpers */
const MAX_BUFFER = 8 * 1024 * 1024; // 8MB
const EXEC_TIMEOUT_MS = 8_000;
/** Max domain log files to sample (newest / first N from readdir) */
const MAX_DOMAIN_LOG_FILES = 30;
/** Short TTL so Pulse widgets sharing the same data don't stampede the disk */
const CACHE_TTL_MS = 8_000;

type CacheEntry<T> = { expires: number; value: T };

export class DashboardAnalyticsService {
  private cache = new Map<string, CacheEntry<unknown>>();

  private getCached<T>(key: string): T | undefined {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  private setCache<T>(key: string, value: T, ttlMs: number = CACHE_TTL_MS): T {
    this.cache.set(key, { expires: Date.now() + ttlMs, value });
    return value;
  }

  private async runShell(
    command: string,
    args: string[],
    timeoutMs: number = EXEC_TIMEOUT_MS
  ): Promise<string> {
    try {
      const { stdout } = await execFileAsync(command, args, {
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        // Avoid shell metacharacter injection; callers pass fixed args
      });
      return typeof stdout === 'string' ? stdout : stdout.toString('utf8');
    } catch (error: any) {
      // timed out / killed — return empty rather than failing the whole widget
      if (error?.killed || error?.code === 'ETIMEDOUT' || error?.signal === 'SIGTERM') {
        logger.warn(`Log command timed out: ${command} ${args.join(' ')}`);
      } else if (error?.code !== 'ENOENT') {
        logger.warn(`Log command failed: ${command} ${args.join(' ')}: ${error?.message || error}`);
      }
      return '';
    }
  }

  private getCutoffTime(hours: number): number {
    return Date.now() - hours * 3600 * 1000;
  }

  /**
   * Read ModSecurity lines from the *tail* of a file (never grep the whole file).
   */
  private async readModSecFromFile(filePath: string, maxLines: number = 2000): Promise<string[]> {
    try {
      await fs.access(filePath);
    } catch {
      return [];
    }
    // tail then filter — bounded I/O
    const stdout = await this.runShell('bash', [
      '-c',
      `tail -n ${Math.max(100, Math.min(maxLines * 5, 20000))} "$1" 2>/dev/null | grep -F "ModSecurity:" | tail -n ${maxLines} || true`,
      '--',
      filePath,
    ]);
    return stdout
      .trim()
      .split('\n')
      .filter((line) => line.trim().length > 0);
  }

  private async readModSecLogs(numLines: number): Promise<string[]> {
    const cacheKey = `modsec:${numLines}`;
    const cached = this.getCached<string[]>(cacheKey);
    if (cached) return cached;

    const perFile = Math.max(200, Math.floor(numLines / 2));
    const lines: string[] = [];
    lines.push(...(await this.readModSecFromFile(NGINX_ERROR_LOG, perFile)));

    try {
      const domainLogs = await this.getDomainLogFiles();
      let remaining = Math.max(0, numLines - lines.length);
      for (const domainLog of domainLogs) {
        if (remaining <= 0) break;
        const take = Math.min(300, remaining);
        if (domainLog.errorLog) {
          const chunk = await this.readModSecFromFile(domainLog.errorLog, take);
          lines.push(...chunk);
          remaining -= chunk.length;
        }
        if (remaining <= 0) break;
        if (domainLog.sslErrorLog) {
          const chunk = await this.readModSecFromFile(domainLog.sslErrorLog, take);
          lines.push(...chunk);
          remaining -= chunk.length;
        }
      }
    } catch (error) {
      logger.error('Could not read from domain error logs:', error);
    }

    return this.setCache(cacheKey, lines.slice(-numLines));
  }

  private async readAllAccessLogs(mainLogLines: number, domainLogLines: number): Promise<string[]> {
    const cacheKey = `access:${mainLogLines}:${domainLogLines}`;
    const cached = this.getCached<string[]>(cacheKey);
    if (cached) return cached;

    const lines = await this.readLastLines(NGINX_ACCESS_LOG, mainLogLines);
    const domainLogs = await this.getDomainLogFiles();
    // Cap how many domain files we touch per request
    const limited = domainLogs.slice(0, MAX_DOMAIN_LOG_FILES);
    for (const domainLog of limited) {
      if (domainLog.accessLog) {
        lines.push(...(await this.readLastLines(domainLog.accessLog, domainLogLines)));
      }
      if (domainLog.sslAccessLog) {
        lines.push(...(await this.readLastLines(domainLog.sslAccessLog, domainLogLines)));
      }
    }

    return this.setCache(cacheKey, lines);
  }

  private determineAttackType(parsed: any, defaultType: string = 'Unknown Attack'): string {
    if (parsed.tags && parsed.tags.length > 0) {
      const meaningfulTag = parsed.tags.find(
        (tag: string) =>
          tag.includes('attack') ||
          tag.includes('injection') ||
          tag.includes('xss') ||
          tag.includes('sqli') ||
          tag.includes('rce') ||
          tag.includes('lfi') ||
          tag.includes('rfi') ||
          tag.includes('anomaly-evaluation')
      );
      if (meaningfulTag) {
        return meaningfulTag.replace(/-/g, ' ').replace(/_/g, ' ').toUpperCase();
      }
    }

    if (parsed.message) {
      const attackTypes: { [key: string]: string } = {
        'SQL Injection': 'SQL Injection',
        XSS: defaultType === 'Unknown Attack' ? 'Cross-Site Scripting' : 'XSS Attack',
        RCE: 'Remote Code Execution',
        LFI: 'Local File Inclusion',
        RFI: 'Remote File Inclusion',
        'Command Injection': 'Command Injection',
        'Anomaly Evaluation': 'Anomaly Evaluation',
      };

      for (const [key, value] of Object.entries(attackTypes)) {
        if (parsed.message.includes(key)) return value;
      }
    }

    return defaultType;
  }

  private incrementStatusCode(dataPoint: RequestTrendDataPoint, status: number): void {
    const statusKey = `status${status}` as keyof RequestTrendDataPoint;
    if (statusKey in dataPoint) {
      (dataPoint[statusKey] as number)++;
    } else {
      dataPoint.statusOther++;
    }
  }

  async getRequestTrend(intervalSeconds: number = 5): Promise<RequestTrendDataPoint[]> {
    try {
      const hoursToFetch = 24;
      const dataPoints = Math.floor((hoursToFetch * 3600) / intervalSeconds);
      const now = Date.now();
      // Keep samples modest — 5s intervals over 24h is huge; we only need recent shape
      const lines = await this.readAllAccessLogs(5000, 1500);
      const intervalMap = new Map<number, RequestTrendDataPoint>();

      lines.forEach((line, index) => {
        const parsed = parseAccessLogLine(line, index);
        if (!parsed) return;

        const timestamp = new Date(parsed.timestamp).getTime();
        const intervalIndex = Math.floor((now - timestamp) / (intervalSeconds * 1000));

        if (intervalIndex >= dataPoints || intervalIndex < 0) return;

        const intervalKey = now - intervalIndex * intervalSeconds * 1000;

        if (!intervalMap.has(intervalKey)) {
          intervalMap.set(intervalKey, {
            timestamp: new Date(intervalKey).toISOString(),
            total: 0,
            status200: 0,
            status301: 0,
            status302: 0,
            status400: 0,
            status403: 0,
            status404: 0,
            status500: 0,
            status502: 0,
            status503: 0,
            statusOther: 0,
          });
        }

        const dataPoint = intervalMap.get(intervalKey)!;
        dataPoint.total++;
        if (parsed.statusCode) {
          this.incrementStatusCode(dataPoint, parsed.statusCode);
        }
      });

      return Array.from(intervalMap.values()).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } catch (error) {
      logger.error('Get request trend error:', error);
      return [];
    }
  }

  async getSlowRequests(limit: number = 10): Promise<SlowRequestEntry[]> {
    try {
      const prisma = (await import('../../../config/database')).default;

      const slowRequests = await prisma.performanceMetric.groupBy({
        by: ['domain'],
        _avg: { responseTime: true },
        _max: { responseTime: true },
        _min: { responseTime: true },
        _count: { domain: true },
        orderBy: { _avg: { responseTime: 'desc' } },
        take: limit,
        where: {
          timestamp: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      });

      return slowRequests.map((item) => ({
        path: item.domain,
        avgResponseTime: item._avg.responseTime || 0,
        maxResponseTime: item._max.responseTime || 0,
        minResponseTime: item._min.responseTime || 0,
        requestCount: item._count.domain,
      }));
    } catch (error) {
      logger.error('Get slow requests error:', error);
      return [];
    }
  }

  async getLatestAttacks(limit: number = 5): Promise<AttackTypeStats[]> {
    try {
      const lines = await this.readModSecLogs(3000);

      const attackMap = new Map<
        string,
        { count: number; severity: string; lastOccurred: string; ruleIds: Set<string> }
      >();
      const cutoffTime = this.getCutoffTime(24);

      lines.forEach((line, index) => {
        const parsed = parseModSecLogLine(line, index);
        if (!parsed || !parsed.ruleId) return;

        const timestamp = new Date(parsed.timestamp).getTime();
        if (timestamp < cutoffTime) return;

        const attackType = this.determineAttackType(parsed);

        if (!attackMap.has(attackType)) {
          attackMap.set(attackType, {
            count: 0,
            severity: parsed.severity || 'MEDIUM',
            lastOccurred: parsed.timestamp,
            ruleIds: new Set(),
          });
        }

        const stats = attackMap.get(attackType)!;
        stats.count++;
        if (parsed.ruleId) stats.ruleIds.add(parsed.ruleId);

        if (new Date(parsed.timestamp) > new Date(stats.lastOccurred)) {
          stats.lastOccurred = parsed.timestamp;
        }
      });

      return Array.from(attackMap.entries())
        .map(([attackType, stats]) => ({
          attackType,
          count: stats.count,
          severity: stats.severity,
          lastOccurred: stats.lastOccurred,
          timestamp: stats.lastOccurred,
          ruleIds: Array.from(stats.ruleIds),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      logger.error('Get latest attacks error:', error);
      return [];
    }
  }

  async getLatestNews(limit: number = 20): Promise<LatestAttackEntry[]> {
    try {
      const lines = await this.readModSecLogs(2000);
      const attacks: LatestAttackEntry[] = [];
      const cutoffTime = this.getCutoffTime(24);

      lines.forEach((line, index) => {
        const parsed = parseModSecLogLine(line, index);
        if (!parsed) return;

        const timestamp = new Date(parsed.timestamp).getTime();
        if (timestamp < cutoffTime) return;

        const attackerIp = parsed.ip || 'Unknown';
        const domain = parsed.hostname;
        const attackType = this.determineAttackType(parsed, 'Security Event');
        const logId = parsed.ruleId || parsed.uniqueId || parsed.id;

        attacks.push({
          id: parsed.id,
          timestamp: parsed.timestamp,
          attackerIp,
          domain,
          urlPath: parsed.path || parsed.uri || '/',
          attackType,
          ruleId: parsed.ruleId,
          uniqueId: parsed.uniqueId,
          severity: parsed.severity,
          action: 'Blocked',
          logId,
        } as any);
      });

      return attacks
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      logger.error('Get latest news error:', error);
      return [];
    }
  }

  async getRequestAnalytics(period: 'day' | 'week' | 'month' = 'day'): Promise<RequestAnalyticsResponse> {
    try {
      const periodHours = period === 'day' ? 24 : period === 'week' ? 168 : 720;
      const cutoffTime = this.getCutoffTime(periodHours);
      const lines = await this.readAllAccessLogs(8000, 2000);
      const ipMap = new Map<string, IpAnalyticsEntry>();

      lines.forEach((line, index) => {
        const parsed = parseAccessLogLine(line, index);
        if (!parsed || !parsed.ip) return;

        const timestamp = new Date(parsed.timestamp).getTime();
        if (timestamp < cutoffTime) return;

        if (!ipMap.has(parsed.ip)) {
          ipMap.set(parsed.ip, {
            ip: parsed.ip,
            requestCount: 0,
            errorCount: 0,
            attackCount: 0,
            lastSeen: parsed.timestamp,
          });
        }

        const entry = ipMap.get(parsed.ip)!;
        entry.requestCount++;

        if (parsed.statusCode && parsed.statusCode >= 400) {
          entry.errorCount++;
        }

        if (new Date(parsed.timestamp) > new Date(entry.lastSeen)) {
          entry.lastSeen = parsed.timestamp;
        }
      });

      let modsecLines: string[] = [];
      try {
        modsecLines = await this.readModSecLogs(3000);
      } catch (error) {
        logger.error('Failed to read ModSec logs:', error);
      }

      modsecLines.forEach((line, index) => {
        const parsed = parseModSecLogLine(line, index);
        if (!parsed) return;

        const timestamp = new Date(parsed.timestamp).getTime();
        if (timestamp < cutoffTime) return;

        const attackerIp = parsed.ip;
        if (!attackerIp) return;

        let entry = ipMap.get(attackerIp);
        if (entry) {
          entry.attackCount++;
          entry.requestCount++;
        } else {
          ipMap.set(attackerIp, {
            ip: attackerIp,
            requestCount: 1,
            errorCount: 1,
            attackCount: 1,
            lastSeen: parsed.timestamp,
          });
        }
      });

      const topIps = Array.from(ipMap.values())
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 10);

      return {
        period,
        topIps,
        totalRequests: lines.length,
        uniqueIps: ipMap.size,
        _timestamp: Date.now(),
      } as any;
    } catch (error) {
      logger.error('Get request analytics error:', error);
      return {
        period,
        topIps: [],
        totalRequests: 0,
        uniqueIps: 0,
      };
    }
  }

  async getAttackRatio(): Promise<AttackRatioStats> {
    try {
      const accessLines = await this.readAllAccessLogs(8000, 2000);
      const cutoffTime = this.getCutoffTime(24);
      let totalRequests = 0;

      accessLines.forEach((line, index) => {
        const parsed = parseAccessLogLine(line, index);
        if (!parsed) return;

        const timestamp = new Date(parsed.timestamp).getTime();
        if (timestamp >= cutoffTime) {
          totalRequests++;
        }
      });

      const modsecLines = await this.readModSecLogs(3000);
      let attackRequests = 0;

      modsecLines.forEach((line, index) => {
        const parsed = parseModSecLogLine(line, index);
        if (!parsed) return;

        const timestamp = new Date(parsed.timestamp).getTime();
        if (timestamp >= cutoffTime) {
          attackRequests++;
        }
      });

      const normalRequests = Math.max(0, totalRequests - attackRequests);
      const attackPercentage = totalRequests > 0 ? (attackRequests / totalRequests) * 100 : 0;

      return {
        totalRequests,
        attackRequests,
        normalRequests,
        attackPercentage: parseFloat(attackPercentage.toFixed(2)),
      };
    } catch (error) {
      logger.error('Get attack ratio error:', error);
      return {
        totalRequests: 0,
        attackRequests: 0,
        normalRequests: 0,
        attackPercentage: 0,
      };
    }
  }

  private async readLastLines(filePath: string, numLines: number): Promise<string[]> {
    try {
      await fs.access(filePath);
    } catch {
      return [];
    }
    const n = Math.max(1, Math.min(numLines, 50000));
    const stdout = await this.runShell('tail', ['-n', String(n), filePath]);
    return stdout
      .trim()
      .split('\n')
      .filter((line: string) => line.trim().length > 0);
  }

  private async getDomainLogFiles(): Promise<
    { domain: string; accessLog: string; errorLog: string; sslAccessLog: string; sslErrorLog: string }[]
  > {
    const cached = this.getCached<
      { domain: string; accessLog: string; errorLog: string; sslAccessLog: string; sslErrorLog: string }[]
    >('domain-log-files');
    if (cached) return cached;

    try {
      const files = await fs.readdir(NGINX_LOG_DIR);
      const domainLogs: {
        [key: string]: {
          accessLog?: string;
          errorLog?: string;
          sslAccessLog?: string;
          sslErrorLog?: string;
        };
      } = {};

      files.forEach((file) => {
        const sslAccessMatch = file.match(/^(.+?)[-_]ssl[-_]access\.log$/);
        const sslErrorMatch = file.match(/^(.+?)[-_]ssl[-_]error\.log$/);
        const accessMatch = !file.includes('ssl') && file.match(/^(.+?)[-_]access\.log$/);
        const errorMatch = !file.includes('ssl') && file.match(/^(.+?)[-_]error\.log$/);

        if (sslAccessMatch) {
          const domain = sslAccessMatch[1];
          if (!domainLogs[domain]) domainLogs[domain] = {};
          domainLogs[domain].sslAccessLog = `${NGINX_LOG_DIR}/${file}`;
        } else if (sslErrorMatch) {
          const domain = sslErrorMatch[1];
          if (!domainLogs[domain]) domainLogs[domain] = {};
          domainLogs[domain].sslErrorLog = `${NGINX_LOG_DIR}/${file}`;
        } else if (accessMatch) {
          const domain = accessMatch[1];
          if (!domainLogs[domain]) domainLogs[domain] = {};
          domainLogs[domain].accessLog = `${NGINX_LOG_DIR}/${file}`;
        } else if (errorMatch) {
          const domain = errorMatch[1];
          if (!domainLogs[domain]) domainLogs[domain] = {};
          domainLogs[domain].errorLog = `${NGINX_LOG_DIR}/${file}`;
        }
      });

      const result = Object.entries(domainLogs)
        .map(([domain, logs]) => ({
          domain,
          accessLog: logs.accessLog || '',
          errorLog: logs.errorLog || '',
          sslAccessLog: logs.sslAccessLog || '',
          sslErrorLog: logs.sslErrorLog || '',
        }))
        .slice(0, MAX_DOMAIN_LOG_FILES);

      return this.setCache('domain-log-files', result, 60_000);
    } catch (error) {
      logger.error('Error reading domain log files:', error);
      return [];
    }
  }
}

export const dashboardAnalyticsService = new DashboardAnalyticsService();
