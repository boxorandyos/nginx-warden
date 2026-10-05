import { describe, expect, it } from 'vitest';
import { hostUpdateAllowed, maintenanceKeyMatches, parseMaintenanceKind, planSlaveUpgrades, slaveMaintenanceUrl, webSystemUpdateEnabled } from '../maintenance';

describe('maintenance planning', () => {
  it('accepts product and package kinds', () => {
    expect(parseMaintenanceKind('product')).toBe('product');
    expect(parseMaintenanceKind('packages')).toBe('packages');
    expect(() => parseMaintenanceKind('apt')).toThrow(/kind/);
  });

  it('builds a slave maintenance call without putting the key in the url', () => {
    const [call] = planSlaveUpgrades(
      [
        { id: 's1', name: 'edge-b', host: '10.0.0.8', port: 3001, apiKey: 'secret-key', syncEnabled: true },
        { id: 's2', name: 'paused', host: '10.0.0.9', port: 3001, apiKey: 'other', syncEnabled: false },
      ],
      'packages',
    );
    expect(call.url).toBe('http://10.0.0.8:3001/api/slave/maintenance');
    expect(call.url).not.toContain('secret-key');
    expect(call.headers['X-API-Key']).toBe('secret-key');
    expect(call.body).toEqual({ kind: 'packages' });
    expect(planSlaveUpgrades([], 'product')).toEqual([]);
  });

  it('plans a host update unless a flag explicitly allows it', () => {
    expect(webSystemUpdateEnabled(undefined)).toBe(false);
    expect(webSystemUpdateEnabled('false')).toBe(false);
    expect(webSystemUpdateEnabled('1')).toBe(true);
    expect(hostUpdateAllowed(false, undefined)).toBe(false);
    expect(hostUpdateAllowed(true, undefined)).toBe(true);
    expect(hostUpdateAllowed(false, '1')).toBe(true);
    expect(hostUpdateAllowed(true, '0')).toBe(false);
    expect(hostUpdateAllowed(false, 'true')).toBe(true);
    expect(hostUpdateAllowed(true, 'false')).toBe(false);
  });

  it('rejects a host that could change the request target', () => {
    expect(() => slaveMaintenanceUrl('10.0.0.8/evil', 3001)).toThrow(/host/);
    expect(maintenanceKeyMatches('abc', 'abc')).toBe(true);
    expect(maintenanceKeyMatches('abc', 'abd')).toBe(false);
    expect(maintenanceKeyMatches('abc', 'abcd')).toBe(false);
  });
});
