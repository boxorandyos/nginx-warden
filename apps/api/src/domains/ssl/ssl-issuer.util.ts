import { SSL_CONSTANTS } from './ssl.types';

export type AcmeProviderId = 'letsencrypt' | 'zerossl';

const LETSENCRYPT_HINTS = [
  "let's encrypt",
  'letsencrypt',
  'lets encrypt',
  'internet security research group',
  'isrg',
];

const ZEROSSL_HINTS = ['zerossl', 'zero ssl'];

/**
 * Normalize UI/API ACME provider values to the Prisma enum.
 */
export function normalizeAcmeProvider(value?: string | null): AcmeProviderId | null {
  if (!value) return null;
  const v = value.toLowerCase().replace(/[\s_-]+/g, '');
  if (v === 'letsencrypt' || v === 'le' || v === 'letsencryptorg') return 'letsencrypt';
  if (v === 'zerossl' || v === 'zerosslcom') return 'zerossl';
  if (value.toLowerCase().includes('let')) {
    if (LETSENCRYPT_HINTS.some((h) => value.toLowerCase().includes(h))) return 'letsencrypt';
  }
  if (ZEROSSL_HINTS.some((h) => value.toLowerCase().includes(h))) return 'zerossl';
  return null;
}

export function toPrismaAcmeProvider(value?: string | null): AcmeProviderId | null {
  return normalizeAcmeProvider(value);
}

export function acmeServerFlag(provider: AcmeProviderId): string {
  return provider === 'zerossl' ? 'zerossl' : 'letsencrypt';
}

export function displayIssuerForProvider(provider: AcmeProviderId): string {
  return provider === 'zerossl' ? SSL_CONSTANTS.ZEROSSL_ISSUER : SSL_CONSTANTS.LETSENCRYPT_ISSUER;
}

/**
 * True when a stored issuer / provider can be renewed via acme.sh.
 * Parsed issuer strings are often "Let's Encrypt", "ZeroSSL GmbH", "ISRG Root X1", etc.
 */
export function isAcmeRenewable(
  issuer?: string | null,
  acmeProvider?: string | null
): boolean {
  if (normalizeAcmeProvider(acmeProvider)) return true;
  if (!issuer) return false;

  const i = issuer.toLowerCase();
  if (LETSENCRYPT_HINTS.some((h) => i.includes(h))) return true;
  if (ZEROSSL_HINTS.some((h) => i.includes(h))) return true;

  // Exact constants used by older Warden builds
  return SSL_CONSTANTS.AUTO_RENEWABLE_ISSUERS.some(
    (known) => known.toLowerCase() === i
  );
}

export function inferProviderFromIssuer(issuer?: string | null): AcmeProviderId | null {
  if (!issuer) return null;
  const i = issuer.toLowerCase();
  if (ZEROSSL_HINTS.some((h) => i.includes(h))) return 'zerossl';
  if (LETSENCRYPT_HINTS.some((h) => i.includes(h))) return 'letsencrypt';
  return null;
}
