/**
 * Notification helpers — smoke test
 */

import { describe, it, expect } from 'vitest';

describe('notification.service', () => {
  it('module can be imported', async () => {
    const mod = await import('../services/notification.service');
    expect(typeof mod.sendTestNotification).toBe('function');
  });
});
