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
  until?: number;
  car?: (t: number) => CarState;
}) => {
  const stall = options.stall ?? 20;
  const car = options.car ?? ((t: number) => pittingCar(t, stall));
  const detector = new PitStopDetector(2);
  const completed = [];
  let entered = false;
  let exited = false;
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
      playerTowing: false,
      beforePct: 0.02,
      afterPct: 0.02,
    };
    const events = detector.update(frame);
    completed.push(...events.completed.map((stop) => ({ ...stop })));
    entered ||= events.playerEntered;
    exited ||= events.playerExited;
  }
  return { completed, entered, exited };
};

describe('PitStopDetector', () => {
  it('measures the window, stall time and lane positions of a stop', () => {
    const { completed, entered, exited } = run({});
    expect(entered).toBe(true);
    expect(exited).toBe(true);
    expect(completed).toHaveLength(1);
    const stop = completed[0];
    expect(stop.tainted).toBe(false);
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

  it('taints a stop made under caution', () => {
    expect(run({ cautionAt: 60 }).completed[0].tainted).toBe(true);
  });

  it('taints a very long stop', () => {
    expect(run({ stall: 700, until: 800 }).completed[0].tainted).toBe(true);
  });

  it('ignores a car that appears in its stall, as after a tow or reset', () => {
    const towed = (t: number): CarState =>
      t < 5
        ? { pct: -1, onPitRoad: false, surface: TrackLocation.NotInWorld }
        : pittingCar(t + 45, 20);
    expect(run({ car: towed }).completed).toHaveLength(0);
  });
});
