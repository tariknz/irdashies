import { describe, expect, it } from 'vitest';
import { comparisonCheckSatisfied } from './gates';

describe('comparison gate status', () => {
  it('treats deliberately not-applicable gates as satisfied', () => {
    expect(
      comparisonCheckSatisfied({ passed: true, target: '< 3 ms' })
    ).toBe(true);
    expect(
      comparisonCheckSatisfied({
        passed: null,
        target: 'not-applicable: game FPS is historical in an isolated replay tape',
      })
    ).toBe(true);
    expect(
      comparisonCheckSatisfied({
        passed: null,
        target: 'inconclusive: short duration',
      })
    ).toBe(false);
    expect(
      comparisonCheckSatisfied({ passed: false, target: '< 3 ms' })
    ).toBe(false);
  });
});
