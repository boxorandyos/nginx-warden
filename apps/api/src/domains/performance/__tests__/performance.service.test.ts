/**
 * Performance Service Tests (mocked dependencies)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/metrics.service', () => ({
  collectMetricsFromLogs: vi.fn().mockResolvedValue([]),
  calculateMetrics: vi.fn().mockReturnValue([]),
}));

vi.mock('../performance.repository', () => ({
  saveMetrics: vi.fn().mockResolvedValue(undefined),
  findMetrics: vi.fn().mockResolvedValue([]),
  deleteOldMetrics: vi.fn().mockResolvedValue({ deletedCount: 0 }),
}));

import * as performanceService from '../performance.service';
import * as metricsService from '../services/metrics.service';

describe('performance.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(metricsService.collectMetricsFromLogs).mockResolvedValue([]);
    vi.mocked(metricsService.calculateMetrics).mockReturnValue([]);
  });

  it('getMetrics returns array from calculateMetrics', async () => {
    vi.mocked(metricsService.calculateMetrics).mockReturnValue([
      {
        domain: 'x.com',
        timestamp: new Date(),
        responseTime: 10,
        throughput: 0.1,
        errorRate: 0,
        requestCount: 5,
      },
    ]);
    const m = await performanceService.getMetrics('x.com', '1h');
    expect(Array.isArray(m)).toBe(true);
    expect(m.length).toBe(1);
    expect(m[0].domain).toBe('x.com');
  });

  it('getStats returns zeros when no metrics', async () => {
    vi.mocked(metricsService.calculateMetrics).mockReturnValue([]);
    const s = await performanceService.getStats('all', '1h');
    expect(s.totalRequests).toBe(0);
    expect(s.avgResponseTime).toBe(0);
  });
});
