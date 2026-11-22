import { describe, expect, it } from 'vitest';
import {
  calculateDriverRankGain,
  driverRankVisualScore,
  normaliseDriverRankProgress,
} from './driverRankGain';

describe('normaliseDriverRankProgress', () => {
  it('keeps percent values and clamps to 0..100', () => {
    expect(normaliseDriverRankProgress(70)).toBe(70);
    expect(normaliseDriverRankProgress(0.42)).toBe(0.42);
    expect(normaliseDriverRankProgress(1)).toBe(1);
    expect(normaliseDriverRankProgress(0)).toBe(0);
    expect(normaliseDriverRankProgress(-5)).toBe(0);
    expect(normaliseDriverRankProgress(150)).toBe(100);
  });
});

describe('driverRankVisualScore', () => {
  it('matches doX TryParseDriverRankScore × 100', () => {
    // Bronze 3 @ 70% → score 3.70 → visual 370
    expect(driverRankVisualScore('Bronze', 3, 70)).toBe(370);
    // Silver 1 @ 0% → score 4.00 → visual 400
    expect(driverRankVisualScore('Silver', 1, 0)).toBe(400);
    // Gold 2 @ 50% → 4 + 3 + 1 + 0.5 = 8.5 → 850
    expect(driverRankVisualScore('Gold', 2, 50)).toBe(850);
  });

  it('rejects Pro and unknown ranks', () => {
    expect(driverRankVisualScore('Pro', undefined, 10)).toBeUndefined();
    expect(driverRankVisualScore('Diamond', 1, 10)).toBeUndefined();
  });
});

describe('calculateDriverRankGain', () => {
  it('gives equal opposite gains for equal ranks when one finishes ahead', () => {
    const visual = driverRankVisualScore('Silver', 1, 0);
    expect(visual).toBe(400);

    const results = calculateDriverRankGain([
      {
        driver: 'a',
        racePosition: 1,
        qualiPosition: 0,
        visualScore: visual ?? 0,
      },
      {
        driver: 'b',
        racePosition: 2,
        qualiPosition: 0,
        visualScore: visual ?? 0,
      },
    ]);

    expect(results).toHaveLength(2);
    const a = results.find((r) => r.driver === 'a');
    const b = results.find((r) => r.driver === 'b');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // K=30, n=2 → scale = 30/(2*1) = 15; delta = 0.5 → ±7.5
    expect(a?.estimatedGain).toBeCloseTo(7.5, 5);
    expect(b?.estimatedGain).toBeCloseTo(-7.5, 5);
    // Math.round(±7.5) → 8 / -7 (half-away-from-zero only for positives).
    expect(Math.round(a?.estimatedGain ?? 0)).toBe(8);
    expect(Math.round(b?.estimatedGain ?? 0)).toBe(-7);
  });

  it('includes qualifying when both positions are known', () => {
    const withoutQuali = calculateDriverRankGain([
      {
        driver: 'a',
        racePosition: 1,
        qualiPosition: 0,
        visualScore: 400,
      },
      {
        driver: 'b',
        racePosition: 2,
        qualiPosition: 0,
        visualScore: 400,
      },
    ])[0].estimatedGain;

    const withQuali = calculateDriverRankGain([
      {
        driver: 'a',
        racePosition: 1,
        qualiPosition: 1,
        visualScore: 400,
      },
      {
        driver: 'b',
        racePosition: 2,
        qualiPosition: 2,
        visualScore: 400,
      },
    ])[0].estimatedGain;

    // Same race + matching quali adds the 15/85 weight on the same delta.
    expect(withQuali).toBeGreaterThan(withoutQuali);
    expect(withQuali).toBeCloseTo(withoutQuali * (1 + 0.17647058823529413), 5);
  });

  it('returns nothing for a single driver', () => {
    expect(
      calculateDriverRankGain([
        {
          driver: 1,
          racePosition: 1,
          qualiPosition: 1,
          visualScore: 400,
        },
      ])
    ).toEqual([]);
  });
});
