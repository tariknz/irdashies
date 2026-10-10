import { describe, expect, it } from 'vitest';
import {
  createLmuOpponentLapDistanceState,
  refineLmuOpponentLapDistPcts,
  resetLmuOpponentLapDistanceState,
  type LmuOpponentLapDistanceFrame,
} from './opponentLapDistance';

const TRACK_M = 7000;
/** The bridge's poll cadence. Scoring only moves every ~200 ms. */
const POLL_S = 0.016;

const frame = (
  overrides: Partial<LmuOpponentLapDistanceFrame> = {}
): LmuOpponentLapDistanceFrame => ({
  scoringPcts: [0.1, 0.2],
  speeds: [50, 50],
  lapNumbers: [1, 1],
  elapsedTimes: [0, 0],
  telemetryAvailable: [1, 1],
  trackLengthM: TRACK_M,
  playerCarIdx: -1,
  ...overrides,
});

describe('refineLmuOpponentLapDistPcts', () => {
  it('advances a car between scoring updates', () => {
    // Scoring is frozen at 0.2 while the clock runs on, which is exactly the
    // 5 Hz window this exists to fill.
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.2];

    refineLmuOpponentLapDistPcts(state, out, frame({ elapsedTimes: [0, 0] }));
    const first = out[1];
    refineLmuOpponentLapDistPcts(
      state,
      out,
      frame({ elapsedTimes: [0, POLL_S * 4] })
    );

    expect(out[1]).toBeGreaterThan(first);
    // 50 m/s for 64 ms is 3.2 m on a 7 km lap.
    expect(out[1] - 0.2).toBeCloseTo((50 * POLL_S * 4) / TRACK_M, 5);
  });

  it('resynchronises when scoring moves on, so drift cannot accumulate', () => {
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.2];

    refineLmuOpponentLapDistPcts(state, out, frame());
    refineLmuOpponentLapDistPcts(state, out, frame({ elapsedTimes: [0, 0.2] }));
    // Scoring catches up to a value past the estimate.
    refineLmuOpponentLapDistPcts(
      state,
      out,
      frame({ scoringPcts: [0.1, 0.25], elapsedTimes: [0, 0.2] })
    );

    expect(out[1]).toBeCloseTo(0.25, 5);
  });

  it('leaves the player slot to the caller', () => {
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.2];

    // Two frames: the first anchors each car, the second integrates from it.
    refineLmuOpponentLapDistPcts(state, out, frame({ playerCarIdx: 0 }));
    refineLmuOpponentLapDistPcts(
      state,
      out,
      frame({ playerCarIdx: 0, elapsedTimes: [0.2, 0.2] })
    );

    expect(out[0]).toBe(0.1);
    expect(out[1]).toBeGreaterThan(0.2);
    // Never given a state at all, rather than given one and skipped.
    expect(state.byCarIdx[0]).toBeUndefined();
  });

  it('leaves a car with no telemetry at its scoring value', () => {
    // An empty slot, or a car not in the world: there is nothing to integrate
    // with, so inventing a position would be worse than the 5 Hz one.
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.2];

    refineLmuOpponentLapDistPcts(
      state,
      out,
      frame({ telemetryAvailable: [1, 0], elapsedTimes: [0.2, 0.2] })
    );

    expect(out[1]).toBe(0.2);
  });

  it('falls back to scoring when the sim exports no per-car speed', () => {
    // An older addon build. The worst case has to be exactly the old
    // behaviour rather than a crash or a frozen grid.
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.2];

    refineLmuOpponentLapDistPcts(
      state,
      out,
      frame({ speeds: undefined, elapsedTimes: [0.2, 0.2] })
    );

    expect(out).toEqual([0.1, 0.2]);
  });

  it('does nothing without a track length', () => {
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.2];

    refineLmuOpponentLapDistPcts(state, out, frame({ trackLengthM: 0 }));

    expect(out).toEqual([0.1, 0.2]);
  });

  it('does not read past the shorter of the two arrays', () => {
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1];

    expect(() =>
      refineLmuOpponentLapDistPcts(state, out, frame())
    ).not.toThrow();
    expect(out).toHaveLength(1);
  });

  it('allocates one state per car and keeps it across frames', () => {
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.2];

    refineLmuOpponentLapDistPcts(state, out, frame());
    const held = state.byCarIdx[1];
    refineLmuOpponentLapDistPcts(state, out, frame({ elapsedTimes: [0, 0.1] }));

    // Same object, mutated in place: a frame must not allocate per car.
    expect(state.byCarIdx[1]).toBe(held);
  });

  it('forgets every car on reset', () => {
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.2];
    refineLmuOpponentLapDistPcts(state, out, frame());
    expect(state.byCarIdx.length).toBeGreaterThan(0);

    resetLmuOpponentLapDistanceState(state);

    expect(state.byCarIdx.length).toBe(0);
  });

  it('resyncs a car across its own lap boundary', () => {
    const state = createLmuOpponentLapDistanceState();
    const out = [0.1, 0.99];

    refineLmuOpponentLapDistPcts(
      state,
      out,
      frame({ scoringPcts: [0.1, 0.99] })
    );
    // Over the line: scoring wraps and the lap number steps.
    refineLmuOpponentLapDistPcts(
      state,
      out,
      frame({
        scoringPcts: [0.1, 0.01],
        lapNumbers: [1, 2],
        elapsedTimes: [0, 0.05],
      })
    );

    expect(out[1]).toBeCloseTo(0.01, 5);
  });
});
