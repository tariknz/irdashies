import { describe, it, expect } from 'vitest';
import { computeStintLap } from './lapCountUtils';

describe('computeStintLap', () => {
  it('returns nothing when lastLap is undefined', () => {
    expect(computeStintLap({})).toEqual({ lap: undefined, unknown: false });
  });

  describe('with an observed pit stop', () => {
    it('counts laps since pit with the +1 out-lap offset', () => {
      // Pitted on lap 5, now on lap 5 (just exited, not yet crossed S/F) → L1
      expect(computeStintLap({ lastLap: 5, lastPitLap: 5 })).toEqual({
        lap: 1,
        unknown: false,
      });
    });

    it('increments as the stint progresses', () => {
      // Pitted on lap 5, now on lap 8 → L4
      expect(computeStintLap({ lastLap: 8, lastPitLap: 5 })).toEqual({
        lap: 4,
        unknown: false,
      });
    });

    it('omits the +1 offset on pitExitAfterSF tracks', () => {
      // Pit exit is past S/F so lap already incremented to 6 → L1
      expect(
        computeStintLap({ lastLap: 6, lastPitLap: 5, pitExitAfterSF: true })
      ).toEqual({ lap: 1, unknown: false });
    });
  });

  describe('without an observed pit stop', () => {
    it('counts the out-lap as L1 when watched from the start', () => {
      // First seen at lap 0, on the grid/out-lap before the first S/F crossing → L1
      expect(computeStintLap({ lastLap: 0, firstObservedLap: 0 })).toEqual({
        lap: 1,
        unknown: false,
      });
    });

    it('counts the session lap plus the out-lap offset', () => {
      // First seen at lap 0, never pitted, crossed S/F 20 times → L21
      expect(computeStintLap({ lastLap: 20, firstObservedLap: 0 })).toEqual({
        lap: 21,
        unknown: false,
      });
    });

    it('treats first-seen lap 1 as watched from the start', () => {
      expect(computeStintLap({ lastLap: 12, firstObservedLap: 1 })).toEqual({
        lap: 13,
        unknown: false,
      });
    });

    it('is unknown when joined mid-session', () => {
      // First seen at lap 14, no pit observed → stint lap unknown
      expect(computeStintLap({ lastLap: 22, firstObservedLap: 14 })).toEqual({
        lap: undefined,
        unknown: true,
      });
    });

    it('is unknown when the car was never observed', () => {
      expect(computeStintLap({ lastLap: 22 })).toEqual({
        lap: undefined,
        unknown: true,
      });
    });
  });

  describe('when the car is not out on track', () => {
    it('shows nothing even with a valid pit stop', () => {
      expect(
        computeStintLap({ lastLap: 8, lastPitLap: 5, onTrack: false })
      ).toEqual({ lap: undefined, unknown: false });
    });

    it('shows nothing instead of the unknown placeholder', () => {
      // Would otherwise be unknown (mid-session join), but the car is not out
      expect(
        computeStintLap({ lastLap: 22, firstObservedLap: 14, onTrack: false })
      ).toEqual({ lap: undefined, unknown: false });
    });

    it('still computes normally when onTrack is true', () => {
      expect(
        computeStintLap({ lastLap: 8, lastPitLap: 5, onTrack: true })
      ).toEqual({ lap: 4, unknown: false });
    });
  });
});
