import { describe, expect, it, vi, afterEach } from 'vitest';
import { isReverseProxiedPage, resolveApiBaseUrl } from '../resolve-api-base-url';

describe('isReverseProxiedPage', () => {
  it('treats default https/http ports as reverse-proxied', () => {
    expect(isReverseProxiedPage({ protocol: 'https:', port: '' })).toBe(true);
    expect(isReverseProxiedPage({ protocol: 'https:', port: '443' })).toBe(true);
    expect(isReverseProxiedPage({ protocol: 'http:', port: '' })).toBe(true);
    expect(isReverseProxiedPage({ protocol: 'http:', port: '80' })).toBe(true);
  });

  it('treats explicit UI ports as direct access', () => {
    expect(isReverseProxiedPage({ protocol: 'http:', port: '8088' })).toBe(false);
    expect(isReverseProxiedPage({ protocol: 'https:', port: '8443' })).toBe(false);
  });
});

describe('resolveApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses same-origin /api on https without port', () => {
    vi.stubGlobal('window', {
      location: { href: 'https://proxy.boxo2.us/login' },
    });
    expect(resolveApiBaseUrl()).toBe('https://proxy.boxo2.us/api');
  });

  it('uses host:3001 when UI is on :8088', () => {
    vi.stubGlobal('window', {
      location: { href: 'http://10.10.30.21:8088/' },
    });
    expect(resolveApiBaseUrl()).toBe('http://10.10.30.21:3001/api');
  });
});
