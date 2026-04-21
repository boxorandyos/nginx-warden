/**
 * Alerts Service Tests (smoke)
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../alerts.repository', () => ({
  notificationChannelRepository: {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  alertRuleRepository: {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  sendTestNotification: vi.fn().mockResolvedValue(undefined),
}));

import { notificationChannelService, alertRuleService } from '../alerts.service';

describe('Alerts services', () => {
  it('getAllChannels returns an array', async () => {
    const res = await notificationChannelService.getAllChannels();
    expect(Array.isArray(res)).toBe(true);
  });

  it('getAllRules returns an array', async () => {
    const res = await alertRuleService.getAllRules();
    expect(Array.isArray(res)).toBe(true);
  });
});
