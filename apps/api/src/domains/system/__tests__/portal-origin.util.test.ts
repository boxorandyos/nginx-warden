import { describe, expect, it } from 'vitest';
import { normalizePortalOrigin, normalizePortalOrigins } from '../portal-origin.util';

describe('normalizePortalOrigin', () => {
  it('strips trailing slash and path', () => {
    expect(normalizePortalOrigin('https://proxy.boxo2.us/')).toBe('https://proxy.boxo2.us');
    expect(normalizePortalOrigin('http://10.11.30.21:8088/')).toBe('http://10.11.30.21:8088');
    expect(normalizePortalOrigin('https://proxy.boxo2.us/login')).toBe('https://proxy.boxo2.us');
  });

  it('rejects non-http(s)', () => {
    expect(normalizePortalOrigin('ftp://x')).toBeNull();
    expect(normalizePortalOrigin('not a url')).toBeNull();
  });
});

describe('normalizePortalOrigins', () => {
  it('dedupes after normalization', () => {
    expect(
      normalizePortalOrigins([
        'https://proxy.boxo2.us/',
        'https://proxy.boxo2.us',
        'http://10.11.30.21:8088/',
      ])
    ).toEqual(['https://proxy.boxo2.us', 'http://10.11.30.21:8088']);
  });
});
