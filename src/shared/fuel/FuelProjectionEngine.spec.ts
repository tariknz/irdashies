import { describe, expect, it, vi } from 'vitest';

import {
  FuelProjectionEngine,
  type FuelEngineFrame,
} from './FuelProjectionEngine';

const greenFlag = 0x80000000;
const frame = (overrides: Partial<FuelEngineFrame> = {}): FuelEngineFrame => ({
  fuelLevel: 50,
  lap: 1,
  lapDistPct: 0.1,
  onPitRoad: false,
  playerCarTowTime: 0,
  sessionFlags: greenFlag,
  sessionNum: 0,
  sessionTime: 10,
  ...overrides,
});

const createEngine = (now = 1234) =>
  new FuelProjectionEngine({ now: () => now }, { debug: vi.fn() });

const history = { getRecentLaps: () => [] };
const validLap = () => true;
const isGreen = (flags: number) => flags === greenFlag;

describe('FuelProjectionEngine', () => {
  it('emits deterministic commands at a lap crossing', () => {
    const engine = createEngine();
    engine.onFrame(frame(), history, validLap, isGreen, {
      persistLaps: true,
    });

    const commands = engine.onFrame(
      frame({ fuelLevel: 47, lap: 2, lapDistPct: 0.01, sessionTime: 100 }),
      history,
      validLap,
      isGreen,
      { persistLaps: true }
    );

    expect(commands).toEqual([
      {
        type: 'lapCompleted',
        lap: {
          lapNumber: 1,
          fuelUsed: 3,
          lapTime: 90,
          isGreenFlag: true,
          isValidForCalc: true,
          isOutLap: false,
          isInLap: false,
          wasTowed: false,
          timestamp: 1234,
          sessionNum: 0,
        },
      },
      {
        type: 'saveLap',
        lap: expect.objectContaining({ lapNumber: 1, timestamp: 1234 }),
      },
    ]);
  });

  it('keeps storage outside the engine', () => {
    const engine = createEngine();
    engine.onFrame(frame(), history, validLap, isGreen, {
      persistLaps: false,
    });
    const commands = engine.onFrame(
      frame({ fuelLevel: 47, lap: 2, sessionTime: 100 }),
      history,
      validLap,
      isGreen,
      { persistLaps: false }
    );

    expect(commands.map(({ type }) => type)).toEqual(['lapCompleted']);
  });

  it('does not leak adapter state into snapshots', () => {
    const engine = new FuelProjectionEngine(
      { now: () => 1234 },
      { debug: vi.fn() },
      {
        lastLap: 2,
        lapHistory: new Map(),
      } as Partial<import('./FuelProjectionEngine').FuelEngineState> & {
        lapHistory: Map<never, never>;
      }
    );

    expect(engine.snapshot()).toEqual({
      accumulatedRefuel: 0,
      isLapDistPctReset: false,
      lapCrossingTime: 0,
      lapStartFuel: 0,
      lastLap: 2,
      lastLapDistPct: 0,
      lastSessionFlags: 0,
      wasOnPitRoad: false,
    });
    expect(engine.snapshot()).not.toHaveProperty('lapHistory');
  });

  it('accounts for refuelling without producing negative consumption', () => {
    const engine = createEngine();
    engine.onFrame(frame(), history, validLap, isGreen, {
      persistLaps: false,
    });
    engine.onFrame(
      frame({ fuelLevel: 48, lapDistPct: 0.5, sessionTime: 50 }),
      history,
      validLap,
      isGreen,
      { persistLaps: false }
    );
    engine.onFrame(
      frame({ fuelLevel: 53, lapDistPct: 0.6, sessionTime: 60 }),
      history,
      validLap,
      isGreen,
      { persistLaps: false }
    );
    const commands = engine.onFrame(
      frame({ fuelLevel: 50, lap: 2, lapDistPct: 0.01, sessionTime: 100 }),
      history,
      validLap,
      isGreen,
      { persistLaps: false }
    );

    expect(commands[0]).toMatchObject({
      type: 'lapCompleted',
      lap: { fuelUsed: 5 },
    });
  });

  it('produces identical projections for identical inputs', () => {
    const input = {
      avgConsumption: 3,
      currentFuel: 48.5,
      currentLapUsage: 1.5,
      lap: 2,
      lapDistPct: 0.5,
      lapStartFuel: 50,
      lastLapUsage: 3.1,
      qualifyConsumption: null,
    };
    const first = createEngine();
    const second = createEngine();

    expect([first.project(input), first.project(input)]).toEqual([
      second.project(input),
      second.project(input),
    ]);
  });
});
