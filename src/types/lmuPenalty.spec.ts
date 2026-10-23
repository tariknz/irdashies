import { describe, expect, it } from 'vitest';
import {
  LMU_PENALTY_CODE,
  lmuPenaltyBadge,
  lmuPenaltyBadgeText,
  lmuPenaltyCode,
  lmuPenaltyKind,
  lmuPenaltyKindFromCode,
} from './lmuPenalty';

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

describe('lmuPenaltyCode / lmuPenaltyKindFromCode', () => {
  it('round-trips every kind', () => {
    for (const kind of ['DT', 'SG', 'TIME'] as const) {
      expect(lmuPenaltyKindFromCode(lmuPenaltyCode(kind))).toBe(kind);
    }
  });

  it('reads a clean car as nothing to draw', () => {
    expect(lmuPenaltyCode(undefined)).toBe(LMU_PENALTY_CODE.none);
    expect(lmuPenaltyKindFromCode(LMU_PENALTY_CODE.none)).toBeUndefined();
    expect(lmuPenaltyKindFromCode(undefined)).toBeUndefined();
  });

  it('draws nothing for a kind this build does not know', () => {
    // A future fourth kind is better shown as no badge than as a stop-go.
    expect(lmuPenaltyKindFromCode(99)).toBeUndefined();
    expect(lmuPenaltyKindFromCode(-1)).toBeUndefined();
  });
});

describe('lmuPenaltyBadge', () => {
  it('shows the sim-reported kind for any car, player or not', () => {
    expect(
      lmuPenaltyBadge(LMU_PENALTY_CODE.stopGo, false, undefined, undefined)
    ).toBe('SG');
    expect(lmuPenaltyBadge(LMU_PENALTY_CODE.time, true, 1, 30)).toBe('TIME');
  });

  it('prefers the sim over the estimate when they disagree', () => {
    // The estimate would call this a stop-go, because a time penalty costs
    // seconds at the stop too. The socket says what it actually is.
    expect(lmuPenaltyBadge(LMU_PENALTY_CODE.time, true, 1, 30)).not.toBe('SG');
  });

  it('falls back to the estimate for the player alone', () => {
    expect(lmuPenaltyBadge(undefined, true, 1, 0)).toBe('DT');
    expect(lmuPenaltyBadge(undefined, true, 1, 10)).toBe('SG');
    expect(lmuPenaltyBadge(undefined, false, 1, 10)).toBeUndefined();
  });

  it('treats a code of none as nothing known, not as known clean', () => {
    // The channel is empty when the socket is quiet, so an absent entry and
    // a zero both reach here as "no kind" -- and the player still gets the
    // fallback they had before the socket existed.
    expect(lmuPenaltyBadge(LMU_PENALTY_CODE.none, true, 1, 10)).toBe('SG');
  });

  it('shows nothing when neither source knows anything', () => {
    expect(lmuPenaltyBadge(undefined, true, 0, 0)).toBeUndefined();
    expect(lmuPenaltyBadge(undefined, true, 1, undefined)).toBeUndefined();
    expect(
      lmuPenaltyBadge(undefined, false, undefined, undefined)
    ).toBeUndefined();
  });
});

describe('lmuPenaltyBadgeText', () => {
  it('names the two kinds that are served on track', () => {
    expect(lmuPenaltyBadgeText('DT')).toBe('DT');
    expect(lmuPenaltyBadgeText('SG', 10)).toBe('SG');
  });

  it('shows a time penalty as its magnitude', () => {
    // Nothing is served: the seconds go onto the car's race time, so how
    // much is the only thing worth the badge's width.
    expect(lmuPenaltyBadgeText('TIME', 10)).toBe('+10');
    expect(lmuPenaltyBadgeText('TIME', 29.6)).toBe('+30');
  });

  it('still names a time penalty whose magnitude is unknown', () => {
    // "+0" would read as costing nothing.
    expect(lmuPenaltyBadgeText('TIME')).toBe('TIME');
    expect(lmuPenaltyBadgeText('TIME', 0)).toBe('TIME');
    expect(lmuPenaltyBadgeText('TIME', NaN)).toBe('TIME');
    expect(lmuPenaltyBadgeText('TIME', -5)).toBe('TIME');
  });

  it('draws nothing for a clean car', () => {
    expect(lmuPenaltyBadgeText(undefined, 10)).toBeUndefined();
  });
});
