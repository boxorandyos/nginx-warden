import type { ResolvedAuthPolicy } from '../identity.types';

/** Deny wins; empty allow list = no allow restriction */
export function evaluateGroupRestrictions(
  policy: Pick<ResolvedAuthPolicy, 'groupAllow' | 'groupDeny'>,
  groups: string[]
): { allowed: boolean; reason?: string } {
  const normalized = groups.map((g) => g.toLowerCase());
  const deny = policy.groupDeny.map((g) => g.toLowerCase());
  const allow = policy.groupAllow.map((g) => g.toLowerCase());

  if (deny.some((d) => normalized.includes(d))) {
    return { allowed: false, reason: 'Denied by group restriction' };
  }
  if (allow.length > 0 && !allow.some((a) => normalized.includes(a))) {
    return { allowed: false, reason: 'Not in required groups' };
  }
  return { allowed: true };
}
