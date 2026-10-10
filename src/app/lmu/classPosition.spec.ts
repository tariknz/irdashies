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
  places: [1, 2, 3, 4],
  bestLapTimes: [100, 101, 99, 102],
  lapDistPcts: [0.1, 0.2, 0.3, 0.4],
  isRace: false,
  ...overrides,
});

describe('updateLmuClassPositions', () => {
  it('ranks a practice session on best lap time within each class', () => {
    // Class 1: slot 2 (99 s) then slot 0 (100 s).
    // Class 2: slot 1 (101 s) then slot 3 (102 s).
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

  it('ranks a race on the overall position the sim already gives', () => {
    const positions = updateLmuClassPositions(createLmuClassPositionState(), {
      ...frame({ isRace: true }),
      // Deliberately contrary to the lap times, so the source is unambiguous.
      places: [4, 3, 2, 1],
    });

    expect(positions[0]).toBe(2);
    expect(positions[2]).toBe(1);
    expect(positions[3]).toBe(1);
    expect(positions[1]).toBe(2);
  });

  it('sorts a car with no lap time last, not first', () => {
    // A plain ascending sort on 0 would make an unset time the class leader.
    const positions = updateLmuClassPositions(createLmuClassPositionState(), {
      ...frame(),
      classes: [1, 1, 1],
      bestLapTimes: [0, 95, -1],
      places: [1, 2, 3],
      lapDistPcts: [0.1, 0.2, 0.3],
    });

    expect(positions[1]).toBe(1);
    expect(positions[0]).toBeGreaterThan(1);
    expect(positions[2]).toBeGreaterThan(1);
  });

  it('skips empty slots without consuming a position', () => {
    // -1 is the addon's sentinel; 0 is a car on the start line and must count.
    const positions = updateLmuClassPositions(createLmuClassPositionState(), {
      ...frame(),
      classes: [1, 1, 1],
      bestLapTimes: [100, 99, 98],
      lapDistPcts: [0, -1, 0.5],
    });

    expect(positions[2]).toBe(1);
    expect(positions[0]).toBe(2);
    expect(positions[1]).toBe(0);
  });

  it('settles ties on slot order so the column does not flicker', () => {
    const state = createLmuClassPositionState();
    const tied = {
      ...frame(),
      classes: [1, 1],
      bestLapTimes: [0, 0],
      lapDistPcts: [0.1, 0.2],
    };

    expect(updateLmuClassPositions(state, tied)).toEqual([1, 2]);
    resetLmuClassPositionState(state);
    expect(updateLmuClassPositions(state, tied)).toEqual([1, 2]);
  });

  it('reuses the result until an ordering input moves', () => {
    // Positions change a few times a minute against a 64 Hz poll, so the
    // common frame must not pay for a sort.
    const state = createLmuClassPositionState();
    const first = updateLmuClassPositions(state, frame());
    const fingerprint = state.fingerprint;

    // A frame where only something irrelevant moved.
    const second = updateLmuClassPositions(
      state,
      frame({ lapDistPcts: [0.15, 0.25, 0.35, 0.45] })
    );

    expect(second).toBe(first);
    expect(state.fingerprint).toBe(fingerprint);
  });

  it('recomputes when a best lap improves', () => {
    const state = createLmuClassPositionState();
    updateLmuClassPositions(state, frame());
    expect(state.positions[0]).toBe(2);

    // Slot 0 goes quickest in class 1.
    updateLmuClassPositions(state, frame({ bestLapTimes: [98, 101, 99, 102] }));

    expect(state.positions[0]).toBe(1);
    expect(state.positions[2]).toBe(2);
  });

  it('recomputes when a race place changes', () => {
    const state = createLmuClassPositionState();
    const race = frame({ isRace: true, places: [1, 2, 3, 4] });
    updateLmuClassPositions(state, race);
    expect(state.positions[0]).toBe(1);

    updateLmuClassPositions(
      state,
      frame({ isRace: true, places: [3, 2, 1, 4] })
    );

    expect(state.positions[0]).toBe(2);
    expect(state.positions[2]).toBe(1);
  });

  it('ignores lap-time noise below a millisecond', () => {
    const state = createLmuClassPositionState();
    const first = updateLmuClassPositions(state, frame());

    const second = updateLmuClassPositions(
      state,
      frame({ bestLapTimes: [100.00004, 101.00004, 99.00004, 102.00004] })
    );

    expect(second).toBe(first);
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
