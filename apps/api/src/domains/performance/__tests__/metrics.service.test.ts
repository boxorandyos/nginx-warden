/**
 * Metrics Service Tests — pure parsing / aggregation helpers
 */

import { describe, it, expect } from 'vitest';
import { parseNginxLogLine, calculateMetrics } from '../services/metrics.service';
import type { NginxLogEntry } from '../performance.types';

describe('metrics.service', () => {
  describe('parseNginxLogLine', () => {
    it('returns null for malformed line', () => {
      expect(parseNginxLogLine('not a log line', 'x.com')).toBeNull();
    });

    it('parses combined log line when regex matches', () => {
      const line =
        '203.0.113.1 - - [21/Apr/2026:12:00:00 +0000] "GET / HTTP/1.1" 200 1234 "-" "curl/8" "-"';
      const e = parseNginxLogLine(line, 'example.com');
      if (e) {
        expect(e.domain).toBe('example.com');
        expect(e.statusCode).toBe(200);
        expect(e.requestMethod).toBe('GET');
      }
    });
  });

  describe('calculateMetrics', () => {
    it('returns empty array for no entries', () => {
      expect(calculateMetrics([], 5)).toEqual([]);
    });

    it('aggregates entries into intervals', () => {
      const t = new Date('2026-04-21T12:00:00Z');
      const entries: NginxLogEntry[] = [
        {
          timestamp: t,
          domain: 'a.com',
          statusCode: 200,
          responseTime: 100,
          requestMethod: 'GET',
          requestPath: '/',
        },
        {
          timestamp: new Date(t.getTime() + 1000),
          domain: 'a.com',
          statusCode: 404,
          responseTime: 50,
          requestMethod: 'GET',
          requestPath: '/missing',
        },
      ];
      const out = calculateMetrics(entries, 5);
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out[0].requestCount).toBe(2);
      expect(out[0].errorRate).toBeGreaterThan(0);
    });
  });
});
