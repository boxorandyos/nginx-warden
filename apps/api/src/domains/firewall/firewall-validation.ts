import { isIPv4, isIPv6 } from 'node:net';
import { FirewallSetKind } from '@prisma/client';

export function validateCidrForKind(cidr: string, kind: FirewallSetKind): string | null {
  const trimmed = cidr.trim();
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0) {
    return 'CIDR must include a prefix (e.g. 192.168.1.0/24)';
  }
  const ip = trimmed.slice(0, slash);
  const prefix = parseInt(trimmed.slice(slash + 1), 10);
  if (!Number.isFinite(prefix)) {
    return 'Invalid CIDR prefix';
  }
  const v4 = isIPv4(ip);
  const v6 = isIPv6(ip);
  if (!v4 && !v6) {
    return 'Invalid IP address in CIDR';
  }
  if (v4) {
    if (prefix < 0 || prefix > 32) {
      return 'IPv4 prefix must be 0–32';
    }
    if (
      kind !== FirewallSetKind.trusted_ipv4 &&
      kind !== FirewallSetKind.local_deny_ipv4
    ) {
      return 'This entry type requires an IPv6 CIDR';
    }
  }
  if (v6) {
    if (prefix < 0 || prefix > 128) {
      return 'IPv6 prefix must be 0–128';
    }
    if (
      kind !== FirewallSetKind.trusted_ipv6 &&
      kind !== FirewallSetKind.local_deny_ipv6
    ) {
      return 'This entry type requires an IPv4 CIDR';
    }
  }
  return null;
}
