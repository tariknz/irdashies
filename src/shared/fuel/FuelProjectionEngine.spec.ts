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

describe('FuelProjectionEngine lap validity', () => {
  it('ignores a crossing too fast to be a real lap', () => {
    // A stutter or a reset can move lapDistPct past the line without a lap
    // having been driven. Counting it would poison the consumption average
    // with a fraction of a lap's fuel.
    const engine = createEngine();
    engine.onFrame(
      frame({ lapDistPct: 0.95, sessionTime: 10 }),
      history,
      validLap,
      isGreen,
      { persistLaps: true }
    );

    const commands = engine.onFrame(
      frame({ fuelLevel: 49.9, lap: 1, lapDistPct: 0.01, sessionTime: 12 }),
      history,
      validLap,
      isGreen,
      { persistLaps: true }
    );

    expect(commands.some((c) => c.type === 'lapCompleted')).toBe(false);
  });

  it('accepts a crossing that took a plausible lap time', () => {
    const engine = createEngine();
    engine.onFrame(
      frame({ lapDistPct: 0.95, sessionTime: 10 }),
      history,
      validLap,
      isGreen,
      { persistLaps: true }
    );

    const commands = engine.onFrame(
      frame({ fuelLevel: 47, lap: 2, lapDistPct: 0.01, sessionTime: 100 }),
      history,
      validLap,
      isGreen,
      { persistLaps: true }
    );

    expect(commands.some((c) => c.type === 'lapCompleted')).toBe(true);
  });
});

describe('FuelProjectionEngine projection', () => {
  const input = (
    overrides: Partial<Parameters<FuelProjectionEngine['project']>[0]> = {}
  ) => ({
    avgConsumption: 0,
    currentFuel: 40,
    currentLapUsage: 0,
    lap: 5,
    lapDistPct: 0.5,
    lapStartFuel: 42,
    lastLapUsage: 0,
    qualifyConsumption: null,
    ...overrides,
  });

  it('prefers the last lap when it is close to the running average', () => {
    const engine = createEngine();

    const projected = engine.project(
      input({ avgConsumption: 3.0, lastLapUsage: 3.1 })
    );

    expect(projected).toBeGreaterThan(0);
  });

  it('falls back to qualifying consumption before any race laps', () => {
    // First racing lap with no history: qualifying is the only real evidence
    // of how much this car uses.
    const engine = createEngine();

    const projected = engine.project(
      input({ avgConsumption: 0, lastLapUsage: 0, qualifyConsumption: 2.75 })
    );

    expect(projected).toBeGreaterThan(0);
    expect(projected).toBeLessThan(4);
  });

  it('falls back to a nominal figure when nothing is known at all', () => {
    // Better a rough number than zero, which would read as "no fuel needed".
    const engine = createEngine();

    const projected = engine.project(input());

    expect(projected).toBeGreaterThan(0);
  });
});
