import { describe, expect, it } from 'vitest';
import { evaluateGroupRestrictions } from '../services/group-policy.util';

describe('evaluateGroupRestrictions', () => {
  it('allows when no lists configured', () => {
    expect(evaluateGroupRestrictions({ groupAllow: [], groupDeny: [] }, []).allowed).toBe(true);
  });

  it('deny wins over allow', () => {
    const r = evaluateGroupRestrictions(
      { groupAllow: ['ops'], groupDeny: ['ops'] },
      ['ops']
    );
    expect(r.allowed).toBe(false);
  });

  it('requires membership when allow list set', () => {
    const r = evaluateGroupRestrictions({ groupAllow: ['admins'], groupDeny: [] }, ['ops']);
    expect(r.allowed).toBe(false);
    const ok = evaluateGroupRestrictions({ groupAllow: ['admins'], groupDeny: [] }, ['Admins']);
    expect(ok.allowed).toBe(true);
  });
});
