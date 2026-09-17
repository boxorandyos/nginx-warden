import { describe, expect, it } from 'vitest';
import {
  http2ListenModeFromNginxV,
  parseNginxVersion,
  prefersHttp2Directive,
} from '../services/nginx-http2.util';

describe('nginx-http2.util', () => {
  it('parses nginx -v output', () => {
    expect(parseNginxVersion('nginx version: nginx/1.28.0')).toEqual({
      major: 1,
      minor: 28,
      patch: 0,
    });
  });

  it('prefers http2 on; from 1.25.1 upward', () => {
    expect(prefersHttp2Directive({ major: 1, minor: 25, patch: 0 })).toBe(false);
    expect(prefersHttp2Directive({ major: 1, minor: 25, patch: 1 })).toBe(true);
    expect(prefersHttp2Directive({ major: 1, minor: 28, patch: 0 })).toBe(true);
    expect(prefersHttp2Directive({ major: 1, minor: 24, patch: 0 })).toBe(false);
  });

  it('maps nginx -v strings to listen mode', () => {
    expect(http2ListenModeFromNginxV('nginx version: nginx/1.28.0')).toBe('directive');
    expect(http2ListenModeFromNginxV('nginx version: nginx/1.24.0')).toBe('listen');
  });
});
