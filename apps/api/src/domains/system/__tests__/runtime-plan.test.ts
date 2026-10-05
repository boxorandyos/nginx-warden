import { describe, expect, it } from 'vitest';
import { describeRuntimes, planRuntime } from '../runtime-plan';

describe('runtime upgrades', () => {
  it('offers Node 22 on a new install and names Node 24 as the current LTS', () => {
    const node = describeRuntimes('v20.19.0').find((row) => row.id === 'node');
    expect(node?.newInstall).toBe('22');
    expect(node?.latestLts).toBe('24');
    expect(describeRuntimes('v22.14.0').find((row) => row.id === 'postgres')?.newInstall).toBe('18');
  });

  it('plans the script until host updates are enabled', () => {
    expect(planRuntime('node', false).executed).toBe(false);
    expect(planRuntime('node', false).detail).toContain('upgrade-node.sh 22');
    expect(planRuntime('postgres', true)).toEqual({
      component: 'postgres',
      executed: true,
      detail: 'scheduled: bash scripts/upgrade-postgres.sh 18',
    });
    expect(() => planRuntime('redis', true)).toThrow(/component/);
  });
});