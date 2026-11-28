import { describe, expect, it } from 'vitest';
import {
  createLmuClassPositionState,
  resetLmuClassPositionState,
  updateLmuClassPositions,
  type LmuClassPositionFrame,
} from './classPosition';

/** Two classes interleaved, so a per-class rank cannot pass by accident. */
const frame = (
  overrides: Partial<LmuClassPositionFrame> = {}
): LmuClassPositionFrame => ({
  classes: [1, 2, 1, 2],
  places: [3, 1, 2, 4],
  lapDistPcts: [0.1, 0.2, 0.3, 0.4],
  ...overrides,
});

describe('updateLmuClassPositions', () => {
  it('ranks each class on the place LMU gives', () => {
    const positions = updateLmuClassPositions(
      createLmuClassPositionState(),
      frame()
    );

    expect(positions[2]).toBe(1);
    expect(positions[0]).toBe(2);
    expect(positions[1]).toBe(1);
    expect(positions[3]).toBe(2);
  });

  it('is one-based, as the telemetry channel it fills is', () => {
    // The session-results ClassPosition is zero-based; this is not, and
    // conflating the two made every class start at 2.
    const positions = updateLmuClassPositions(
      createLmuClassPositionState(),
      frame()
    );

    expect(Math.min(...positions.filter((p) => p > 0))).toBe(1);
  });

  it('follows LMU for practice cars with no time yet, ranked on the track', () => {
    // LMU places the cars without a valid lap after the timed ones, by laps
    // done and then how far round the lap they are.
    const positions = updateLmuClassPositions(createLmuClassPositionState(), {
      classes: [1, 1, 1, 1],
      places: [4, 1, 3, 2],
      lapDistPcts: [0.1, 0.5, 0.2, 0.9],
    });

    expect(positions).toEqual([4, 1, 3, 2]);
  });

  it('sorts a car LMU has not placed last, not first', () => {
    const positions = updateLmuClassPositions(createLmuClassPositionState(), {
      classes: [1, 1, 1],
      places: [0, 1, -1],
      lapDistPcts: [0.1, 0.2, 0.3],
    });

    expect(positions[1]).toBe(1);
    expect(positions[0]).toBeGreaterThan(1);
    expect(positions[2]).toBeGreaterThan(1);
  });

  it('skips empty slots without consuming a position', () => {
    // -1 is the addon's sentinel; 0 is a car on the start line and must count.
    const positions = updateLmuClassPositions(createLmuClassPositionState(), {
      classes: [1, 1, 1],
      places: [3, 2, 1],
      lapDistPcts: [0, -1, 0.5],
    });

    expect(positions[2]).toBe(1);
    expect(positions[0]).toBe(2);
    expect(positions[1]).toBe(0);
  });

  it('settles ties on slot order so the column does not flicker', () => {
    const state = createLmuClassPositionState();
    const tied = {
      classes: [1, 1],
      places: [0, 0],
      lapDistPcts: [0.1, 0.2],
    };

    expect(updateLmuClassPositions(state, tied)).toEqual([1, 2]);
    resetLmuClassPositionState(state);
    expect(updateLmuClassPositions(state, tied)).toEqual([1, 2]);
  });

  it('reuses the result until a place moves', () => {
    // Positions change a few times a minute against a 64 Hz poll, so the
    // common frame must not pay for a sort.
    const state = createLmuClassPositionState();
    const first = updateLmuClassPositions(state, frame());
    const fingerprint = state.fingerprint;

    const second = updateLmuClassPositions(
      state,
      frame({ lapDistPcts: [0.15, 0.25, 0.35, 0.45] })
    );

    expect(second).toBe(first);
    expect(state.fingerprint).toBe(fingerprint);
  });

  it('recomputes when a place changes', () => {
    const state = createLmuClassPositionState();
    updateLmuClassPositions(state, frame());
    expect(state.positions[0]).toBe(2);

    updateLmuClassPositions(state, frame({ places: [1, 2, 3, 4] }));

    expect(state.positions[0]).toBe(1);
    expect(state.positions[2]).toBe(2);
  });

  it('returns nothing for an empty grid', () => {
    const positions = updateLmuClassPositions(createLmuClassPositionState(), {
      ...frame(),
      classes: [],
    });

    expect(positions).toEqual([]);
  });

  it('forgets everything on reset', () => {
    const state = createLmuClassPositionState();
    updateLmuClassPositions(state, frame());

    resetLmuClassPositionState(state);

    expect(state.positions).toEqual([]);
    expect(state.fingerprint).toBe(0);
  });
});
