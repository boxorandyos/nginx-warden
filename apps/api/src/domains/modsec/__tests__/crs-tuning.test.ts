import { describe, expect, it } from 'vitest';
import {
  WARDEN_FALSE_POSITIVE_RULE_IDS,
  WARDEN_INBOUND_ANOMALY_THRESHOLD,
  WARDEN_PARANOIA_LEVEL,
  buildWardenCrsExclusionsConf,
  buildWardenCrsSetupConf,
} from '../crs-tuning';

describe('crs-tuning', () => {
  it('raises anomaly threshold and pins paranoia 1', () => {
    const conf = buildWardenCrsSetupConf();
    expect(WARDEN_PARANOIA_LEVEL).toBe(1);
    expect(WARDEN_INBOUND_ANOMALY_THRESHOLD).toBeGreaterThan(5);
    expect(conf).toContain(`tx.blocking_paranoia_level=${WARDEN_PARANOIA_LEVEL}`);
    expect(conf).toContain(
      `tx.inbound_anomaly_score_threshold=${WARDEN_INBOUND_ANOMALY_THRESHOLD}`
    );
    expect(conf).toContain('PUT PATCH DELETE');
    expect(conf).toContain('application/json');
  });

  it('excludes protocol-policy FPs but not SQLi/XSS rule files', () => {
    const conf = buildWardenCrsExclusionsConf();
    for (const id of WARDEN_FALSE_POSITIVE_RULE_IDS) {
      expect(conf).toContain(`SecRuleRemoveById ${id}`);
    }
    expect(conf).not.toContain('942100');
    expect(conf).not.toContain('941100');
  });
});
