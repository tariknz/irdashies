import { describe, expect, it } from 'vitest';
import { TrackLocation } from '@irdashies/types';
import { PitStopDetector, type DetectorFrame } from './PitStopDetector';

/**
 * A car on a 100 s lap that starts at 0.5, enters the lane at 0.9, stops at
 * 0.95 for `stall` seconds and leaves the lane at 0.05, at half track speed
 * in the lane. Over the window 0.88 to 0.07 it loses 15 s plus the stop.
 */
const TRACK_SPEED = 0.01;
const LANE_SPEED = 0.005;

interface CarState {
  pct: number;
  onPitRoad: boolean;
  surface: number;
}

const pittingCar = (t: number, stall: number): CarState => {
  const entry = 40;
  const stopAt = entry + 10;
  const leave = stopAt + stall;
  const exit = leave + 20;
  if (t < entry)
    return {
      pct: 0.5 + t * TRACK_SPEED,
      onPitRoad: false,
      surface: TrackLocation.OnTrack,
    };
  if (t < stopAt)
    return {
      pct: 0.9 + (t - entry) * LANE_SPEED,
      onPitRoad: true,
      surface: TrackLocation.ApproachingPits,
    };
  if (t < leave)
    return { pct: 0.95, onPitRoad: true, surface: TrackLocation.InPitStall };
  if (t < exit)
    return {
      pct: (0.95 + (t - leave) * LANE_SPEED) % 1,
      onPitRoad: true,
      surface: TrackLocation.ApproachingPits,
    };
  return {
    pct: (0.05 + (t - exit) * TRACK_SPEED) % 1,
    onPitRoad: false,
    surface: TrackLocation.OnTrack,
  };
};

const fuelAt = (t: number) => (t < 52 ? 10 : t < 68 ? 10 + 2 * (t - 52) : 42);

const run = (options: {
  stall?: number;
  cautionAt?: number;
  towedAt?: number;
  reversedAt?: number;
  until?: number;
  car?: (t: number) => CarState;
  /** Called after each frame, for looking at a stop in progress. */
  onFrame?: (t: number, detector: PitStopDetector) => void;
}) => {
  const stall = options.stall ?? 20;
  const car = options.car ?? ((t: number) => pittingCar(t, stall));
  const detector = new PitStopDetector(2);
  const completed = [];
  let entered = false;
  const frames = Math.round((options.until ?? 110) * 10);
  for (let i = 0; i <= frames; i++) {
    const t = i / 10;
    const state = car(t);
    const frame: DetectorFrame = {
      time: t,
      pct: [state.pct, -1],
      onPitRoad: [state.onPitRoad, false],
      surface: [state.surface, TrackLocation.NotInWorld],
      caution: options.cautionAt !== undefined && t >= options.cautionAt,
      playerCarIdx: 0,
      pitstopActive: state.surface === TrackLocation.InPitStall,
      fuelLevel: fuelAt(t),
      pitSvFlags: 0b1111 | 0x10,
      repairLeft: 0,
      playerTowing:
        options.towedAt !== undefined &&
        t >= options.towedAt &&
        t < options.towedAt + 1,
      playerReversing:
        options.reversedAt !== undefined &&
        t >= options.reversedAt &&
        t < options.reversedAt + 1,
      beforePct: 0.02,
      afterPct: 0.02,
    };
    const events = detector.update(frame);
    completed.push(...events.completed.map((stop) => ({ ...stop })));
    entered ||= events.playerEntered;
    options.onFrame?.(t, detector);
  }
  return { completed, entered };
};

describe('PitStopDetector', () => {
  it('measures the window, stall time and lane positions of a stop', () => {
    const { completed, entered } = run({});
    expect(entered).toBe(true);
    expect(completed).toHaveLength(1);
    const stop = completed[0];
    expect(stop.tainted).toBe(false);
    expect(stop.taintReasons).toEqual([]);
    expect(stop.firstTaintSeconds).toBeNull();
    expect(stop.entryPct).toBeCloseTo(0.9, 2);
    expect(stop.exitPct).toBeCloseTo(0.05, 2);
    expect(stop.windowStartPct).toBeCloseTo(0.88, 2);
    expect(stop.windowEndPct).toBeCloseTo(0.07, 2);
    // 2 s to entry + 10 + 20 stall + 20 + 2 s to the window end.
    expect(stop.windowSeconds).toBeCloseTo(54, 0);
    expect(stop.stationarySeconds).toBeCloseTo(20, 0);
  });

  it('records the player service: time, fuel rate and tyres', () => {
    const service = run({}).completed[0].service;
    expect(service).not.toBeNull();
    expect(service?.serviceSeconds).toBeCloseTo(20, 0);
    expect(service?.fuelAddedLitres).toBeCloseTo(32, 0);
    expect(service?.fuelSeconds).toBeCloseTo(16, 0);
    expect(service?.tyresChanged).toBe(0b1111);
    expect(service?.fastRepair).toBe(false);
  });

  it('measures a drive-through with no stall time', () => {
    const stop = run({ stall: 0 }).completed[0];
    expect(stop.stationarySeconds).toBe(0);
    expect(stop.windowSeconds).toBeCloseTo(34, 0);
  });

  it('taints a stop made under caution, and says when', () => {
    const stop = run({ cautionAt: 60 }).completed[0];
    expect(stop.tainted).toBe(true);
    expect(stop.taintReasons).toEqual(['caution']);
    expect(stop.firstTaintSeconds).toBeCloseTo(20, 1);
  });

  it('taints a very long stop', () => {
    const stop = run({ stall: 700, until: 800 }).completed[0];
    expect(stop.tainted).toBe(true);
    expect(stop.taintReasons).toEqual(['longStop']);
  });

  it('taints a stop while the player is towed', () => {
    const stop = run({ towedAt: 55 }).completed[0];
    expect(stop.taintReasons).toEqual(['towed']);
    expect(stop.firstTaintSeconds).toBeCloseTo(15, 1);
  });

  it('taints a stop where the player reverses in the pit lane', () => {
    const stop = run({ reversedAt: 49 }).completed[0];
    expect(stop.tainted).toBe(true);
    expect(stop.taintReasons).toEqual(['reversed']);
    expect(stop.firstTaintSeconds).toBeCloseTo(9, 1);
  });

  it('ignores reversing before the player reaches the pit lane', () => {
    const stop = run({ reversedAt: 10 }).completed[0];
    expect(stop.taintReasons).toEqual([]);
  });

  it('names a lost position in the stall, once per reason', () => {
    const blinks = (t: number): CarState =>
      t >= 60 && t < 61
        ? { pct: -1, onPitRoad: true, surface: TrackLocation.NotInWorld }
        : pittingCar(t, 20);
    const stop = run({ car: blinks }).completed[0];
    expect(stop.taintReasons).toEqual(['noPosition', 'notInWorld']);
    expect(stop.firstTaintSeconds).toBeCloseTo(20, 1);
  });

  it('names an approach it never saw', () => {
    // Joins just before the window start, so the start was never passed.
    const late = (t: number): CarState =>
      t < 1
        ? { pct: -1, onPitRoad: false, surface: TrackLocation.NotInWorld }
        : pittingCar(t + 38.5, 20);
    const stop = run({ car: late }).completed[0];
    expect(stop.taintReasons).toEqual(['approachNotSeen']);
    expect(stop.firstTaintSeconds).toBe(0);
  });

  it('reports the player stop in progress until the window end', () => {
    const seen: Record<number, ReturnType<PitStopDetector['playerStop']>> = {};
    run({
      onFrame: (t, detector) => {
        if ([30, 45, 60, 75, 95].includes(t)) seen[t] = detector.playerStop(0);
      },
    });
    expect(seen[30]).toBeNull();
    expect(seen[45]).toMatchObject({
      entryTime: 40,
      windowStartTime: expect.closeTo(38, 0),
      stationarySeconds: 0,
      serviceDone: false,
    });
    expect(seen[60]?.stationarySeconds).toBeCloseTo(10, 0);
    expect(seen[60]?.serviceDone).toBe(false);
    expect(seen[75]?.stationarySeconds).toBeCloseTo(20, 0);
    expect(seen[75]?.serviceDone).toBe(true);
    expect(seen[95]).toBeNull();
  });

  it('ignores a car that appears in its stall, as after a tow or reset', () => {
    const towed = (t: number): CarState =>
      t < 5
        ? { pct: -1, onPitRoad: false, surface: TrackLocation.NotInWorld }
        : pittingCar(t + 45, 20);
    expect(run({ car: towed }).completed).toHaveLength(0);
  });
});
