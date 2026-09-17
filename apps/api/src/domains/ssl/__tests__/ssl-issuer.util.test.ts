import { describe, expect, it } from 'vitest';
import {
  inferProviderFromIssuer,
  isAcmeRenewable,
  normalizeAcmeProvider,
} from '../ssl-issuer.util';

describe('ssl-issuer.util', () => {
  it('normalizes provider aliases', () => {
    expect(normalizeAcmeProvider('letsencrypt')).toBe('letsencrypt');
    expect(normalizeAcmeProvider("Let's Encrypt")).toBe('letsencrypt');
    expect(normalizeAcmeProvider('ZeroSSL')).toBe('zerossl');
    expect(normalizeAcmeProvider('zero-ssl')).toBe('zerossl');
    expect(normalizeAcmeProvider('manual')).toBeNull();
  });

  it('treats parsed LE/ZeroSSL issuer strings as renewable', () => {
    expect(isAcmeRenewable("Let's Encrypt")).toBe(true);
    expect(isAcmeRenewable("C=US, O=Let's Encrypt, CN=R11")).toBe(true);
    expect(isAcmeRenewable('Internet Security Research Group')).toBe(true);
    expect(isAcmeRenewable('ZeroSSL GmbH')).toBe(true);
    expect(isAcmeRenewable('CN=ZeroSSL RSA Domain Secure Site CA')).toBe(true);
    expect(isAcmeRenewable('Cloudflare Origin CA')).toBe(false);
    expect(isAcmeRenewable('Manual Upload')).toBe(false);
  });

  it('trusts stored acmeProvider even when issuer is odd', () => {
    expect(isAcmeRenewable('Unknown CA', 'letsencrypt')).toBe(true);
    expect(isAcmeRenewable('Unknown CA', 'zerossl')).toBe(true);
  });

  it('infers provider from issuer', () => {
    expect(inferProviderFromIssuer("Let's Encrypt")).toBe('letsencrypt');
    expect(inferProviderFromIssuer('ZeroSSL')).toBe('zerossl');
    expect(inferProviderFromIssuer('DigiCert')).toBeNull();
  });
});
