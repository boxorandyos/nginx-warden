import { describe, expect, it } from 'vitest';
import {
  normalizeLocationPath,
  sortLocationsLongestFirst,
  validateCustomLocations,
} from '../services/custom-locations.util';

describe('custom-locations.util', () => {
  it('normalizes paths', () => {
    expect(normalizeLocationPath('api')).toBe('/api');
    expect(normalizeLocationPath('/blog/')).toBe('/blog');
    expect(normalizeLocationPath('//admin//v1/')).toBe('/admin/v1');
    expect(normalizeLocationPath('/')).toBe('/');
  });

  it('rejects missing, root, and duplicate paths', () => {
    const result = validateCustomLocations([
      { path: '', useUpstream: true, upstreams: [{ host: '10.0.0.1', port: 80 }] },
      { path: '/', useUpstream: true, upstreams: [{ host: '10.0.0.1', port: 80 }] },
      { path: '/api', useUpstream: true, upstreams: [{ host: '10.0.0.2', port: 8080 }] },
      { path: '/api/', useUpstream: true, upstreams: [{ host: '10.0.0.3', port: 8081 }] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/required/);
    expect(result.errors.join('\n')).toMatch(/reserved/);
    expect(result.errors.join('\n')).toMatch(/duplicates/);
  });

  it('accepts subdirectory backends and custom config-only locations', () => {
    const result = validateCustomLocations([
      {
        path: '/api',
        useUpstream: true,
        upstreams: [{ host: '10.0.0.2', port: 8080 }],
      },
      {
        path: '/static',
        useUpstream: false,
        config: 'alias /var/www/static/;',
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.normalized.map((l) => l.path)).toEqual(['/api', '/static']);
  });

  it('sorts longest prefix first', () => {
    const sorted = sortLocationsLongestFirst([
      { path: '/api' },
      { path: '/api/v2/users' },
      { path: '/blog' },
    ]);
    expect(sorted[0]?.path).toBe('/api/v2/users');
    expect(sorted.map((l) => l.path).slice(1).sort()).toEqual(['/api', '/blog']);
  });
});
