import { describe, expect, it } from 'vitest';
import { lmuPenaltyKind } from './lmuPenalty';

describe('lmuPenaltyKind', () => {
  it('reads no stationary time as a drive-through', () => {
    // Observed live: penalties 0.0 with a drive-through outstanding.
    expect(lmuPenaltyKind(1, 0)).toBe('DT');
    expect(lmuPenaltyKind(2, 0)).toBe('DT');
  });

  it('reads mandated stationary time as a stop-go', () => {
    // Observed live: penalties 10.0 with a stop-go outstanding.
    expect(lmuPenaltyKind(1, 10)).toBe('SG');
    expect(lmuPenaltyKind(1, 0.5)).toBe('SG');
  });

  it('says nothing when no penalty is outstanding', () => {
    // The time alone means nothing: a clean driver's estimate is 0 too.
    expect(lmuPenaltyKind(0, 0)).toBeUndefined();
    expect(lmuPenaltyKind(0, 10)).toBeUndefined();
  });

  it('says nothing when the estimate has not been polled', () => {
    // Not a drive-through. LMUTraceHUB defaults to DT here; that reads an
    // absent reading as a specific penalty, which it is not.
    expect(lmuPenaltyKind(1, undefined)).toBeUndefined();
    expect(lmuPenaltyKind(1, NaN)).toBeUndefined();
  });

  it('says nothing for a count it cannot read', () => {
    expect(lmuPenaltyKind(undefined, 0)).toBeUndefined();
    expect(lmuPenaltyKind(-1, 0)).toBeUndefined();
  });
});
