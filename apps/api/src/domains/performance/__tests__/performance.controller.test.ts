/**
 * Performance Controller Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const getMetrics = vi.fn();
const getStats = vi.fn();
const getHistory = vi.fn();
const cleanup = vi.fn();

vi.mock('../performance.service', () => ({
  getMetrics,
  getStats,
  getHistory,
  cleanup,
}));

import * as performanceController from '../performance.controller';

describe('Performance Controller', () => {
  const mockRes = (): Response => {
    const json = vi.fn();
    const status = vi.fn().mockReturnThis();
    return { json, status } as unknown as Response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getMetrics.mockResolvedValue([]);
    getStats.mockResolvedValue({
      avgResponseTime: 0,
      avgThroughput: 0,
      avgErrorRate: 0,
      totalRequests: 0,
      slowRequests: [],
      highErrorPeriods: [],
    });
    getHistory.mockResolvedValue([]);
    cleanup.mockResolvedValue({ deletedCount: 0 });
  });

  it('getPerformanceMetrics returns success', async () => {
    const res = mockRes();
    await performanceController.getPerformanceMetrics({ query: { domain: 'a.com', timeRange: '1h' } } as any, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    expect(getMetrics).toHaveBeenCalledWith('a.com', '1h');
  });

  it('getPerformanceMetrics returns 500 on service error', async () => {
    getMetrics.mockRejectedValueOnce(new Error('fail'));
    const res = mockRes();
    await performanceController.getPerformanceMetrics({ query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('getPerformanceStats returns success', async () => {
    const res = mockRes();
    await performanceController.getPerformanceStats({ query: {} } as any, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Object) })
    );
  });

  it('getPerformanceHistory returns success', async () => {
    const res = mockRes();
    await performanceController.getPerformanceHistory({ query: { limit: '10' } } as any, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it('cleanupOldMetrics returns success', async () => {
    const res = mockRes();
    await performanceController.cleanupOldMetrics({ query: { days: '3' } } as any, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { deletedCount: 0 } })
    );
  });
});
