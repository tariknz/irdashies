import { describe, it, expect, beforeEach } from 'vitest';
import { SessionState } from '@irdashies/types';
import { usePitLapStore } from './PitLapStore';
import type { ReplayFixture } from '../../../testing/replayFixture';
import driverSwapPortimao from '../../../../test-data/fixtures/driver-swap-portimao.json';

const fixture = driverSwapPortimao as unknown as ReplayFixture;

const SESSION = 1;
/** The car that changes drivers mid-stop in this window. */
const CAR = 8;

const frames = fixture.frames as unknown as {
  SessionTime: number;
  SessionState: number;
  CarIdxOnPitRoad: boolean[];
  CarIdxTrackSurface: number[];
  CarIdxLap: number[];
}[];

/**
 * Replays a real driver change through the pit timer.
 *
 * This window is the one the bug in #697 was found in: the car crosses the pit
 * entry line on lap 89, its lap ticks to 90 while it is still on pit road
 * because Portimao's pit lane spans the start/finish line, and it then blinks
 * out of the world in its own stall while the incoming driver takes over.
 *
 * A hand-written fixture asserts what the author believes the sim does. This
 * one asserts what it actually did.
 */
describe('pit timing over a real driver change', () => {
  beforeEach(() => {
    usePitLapStore.getState().reset();
  });

  it('contains the sequence that broke the timer', () => {
    const surfaces = new Set(frames.map((f) => f.CarIdxTrackSurface[CAR]));
    const laps = new Set(frames.map((f) => f.CarIdxLap[CAR]));

    // Not in world (-1), in the stall (1), on pit road (2), racing (3).
    expect([...surfaces].sort((a, b) => a - b)).toEqual([-1, 1, 2, 3]);
    // The lap ticking over mid-stop is what defeated the old lap guard.
    expect(laps.has(89)).toBe(true);
    expect(laps.has(90)).toBe(true);
  });

  it('PitLapStore times the whole stop, not just the part after the swap', () => {
    for (const frame of frames) {
      usePitLapStore.getState().updatePitLaps(
        frame.CarIdxOnPitRoad,
        frame.CarIdxLap,
        SESSION,
        // PitLapStoreUpdater floors session time before the store sees it.
        Math.floor(frame.SessionTime),
        frame.CarIdxTrackSurface,
        SessionState.Racing
      );
    }

    const { pitEntryTime, pitExitTime } = usePitLapStore.getState();
    const entry = pitEntryTime[CAR];
    const exit = pitExitTime[CAR];

    expect(entry).not.toBeNull();
    expect(exit).not.toBeNull();

    // Entry is the pit road crossing, not the moment the new driver appeared.
    // Before #697 this measured from the swap and came out ~16s short.
    const duration = (exit ?? 0) - (entry ?? 0);
    expect(duration).toBeGreaterThan(70);
    expect(duration).toBeLessThan(90);
  });
});
