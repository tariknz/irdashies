import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NativeLmu } from './native';
import { mapLmuTelemetry } from './mapTelemetry';
import { mapLmuSession } from './mapSession';
import { createLmuLapDistanceState } from './lapDistance';
import { createLmuOpponentLapDistanceState } from './opponentLapDistance';
import { CarSpeedsProcessor } from '../processors/CarSpeedsProcessor';
import {
  sessionSecondsFrameClock,
  takeTick,
  type TickSchedule,
} from '../processors/ProcessorHost';

const addonPath = path.resolve('build/Release/lmu_tape_node.node');
const tapePath = path.resolve('test-data/telemetry/lmu-session.lmudt');
const available =
  fs.existsSync(addonPath) &&
  fs.existsSync(tapePath) &&
  fs.statSync(tapePath).size > 1024;

const REPLAY_TIMEOUT_MS = 180_000;
const MOVING_KMH = 80;
const SLOW_KMH = 50;
const STOPPED_KMH = 5;
const METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR = 3.6;

interface Measurement {
  frames: number;
  samples: number;
  samplesWithoutTelemetry: number;
  falseSlow: number;
  falseStopped: number;
  slowestWhileMoving: number;
  absErrors: number[];
  garageOffPitRoadFrames: number;
}

const percentile = (sorted: readonly number[], fraction: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];

const replay = (): Measurement => {
  const { LmuSdkNode } = createRequire(import.meta.url)(addonPath) as {
    LmuSdkNode: typeof NativeLmu;
  };
  const sdk = new LmuSdkNode();
  const lapDistanceState = createLmuLapDistanceState();
  const opponentLapDistanceState = createLmuOpponentLapDistanceState();
  const processor = new CarSpeedsProcessor();
  const schedule: TickSchedule = {};
  const measurement: Measurement = {
    frames: 0,
    samples: 0,
    samplesWithoutTelemetry: 0,
    falseSlow: 0,
    falseStopped: 0,
    slowestWhileMoving: Infinity,
    absErrors: [],
    garageOffPitRoadFrames: 0,
  };
  let initialised = false;
  let ticks = 0;
  const deadline = Date.now() + REPLAY_TIMEOUT_MS - 10_000;

  expect(sdk.start()).toBe(true);
  try {
    while (Date.now() < deadline) {
      const rawSession = initialised ? null : sdk.readSession();
      const raw = rawSession ?? sdk.read();
      if (!raw.running) {
        if (initialised) break;
        continue;
      }
      if (rawSession) {
        processor.init(mapLmuSession(rawSession));
        initialised = true;
      }
      measurement.frames += 1;

      const carCount = raw.vehLapDistPct.length;
      for (let carIdx = 0; carIdx < carCount; carIdx += 1) {
        if (
          raw.vehLapDistPct[carIdx] >= 0 &&
          !raw.vehInPits[carIdx] &&
          (raw.vehInGarageStall[carIdx] || raw.vehPitState[carIdx] === 3)
        ) {
          measurement.garageOffPitRoadFrames += 1;
          break;
        }
      }

      const telemetry = mapLmuTelemetry(
        raw,
        lapDistanceState,
        opponentLapDistanceState
      );
      const frameTime = sessionSecondsFrameClock(telemetry);
      if (!takeTick(schedule, processor.tickRateHz, frameTime)) continue;
      processor.onFrame(telemetry);
      ticks += 1;
      const warmedUp = ticks > 1;
      if (!warmedUp) continue;

      const { carSpeeds } = processor.snapshot();
      for (let carIdx = 0; carIdx < carCount; carIdx += 1) {
        const onTrack =
          raw.vehLapDistPct[carIdx] >= 0 &&
          !raw.vehInPits[carIdx] &&
          !raw.vehInGarageStall[carIdx];
        if (!onTrack) continue;
        measurement.samples += 1;
        if (!raw.vehTelemetryAvailable[carIdx]) {
          measurement.samplesWithoutTelemetry += 1;
          continue;
        }
        const rawKmh =
          (raw.vehSpeed?.[carIdx] ?? 0) *
          METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR;
        const processorKmh = carSpeeds[carIdx];
        measurement.absErrors.push(Math.abs(processorKmh - rawKmh));
        if (rawKmh > MOVING_KMH) {
          measurement.slowestWhileMoving = Math.min(
            measurement.slowestWhileMoving,
            processorKmh
          );
          if (processorKmh <= SLOW_KMH) measurement.falseSlow += 1;
          if (processorKmh <= STOPPED_KMH) measurement.falseStopped += 1;
        }
      }
    }
  } finally {
    sdk.stop();
  }
  measurement.absErrors.sort((a, b) => a - b);
  return measurement;
};

describe.skipIf(!available)('LMU car speeds over the recorded race', () => {
  let measured: Measurement;

  beforeAll(() => {
    vi.stubEnv('IRDASHIES_LMU_REPLAY', tapePath);
    vi.stubEnv('IRDASHIES_LMU_REPLAY_SPEED', '100');
    vi.stubEnv('IRDASHIES_LMU_REPLAY_LOOP', '0');
    measured = replay();
  }, REPLAY_TIMEOUT_MS);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('replays every recorded frame', () => {
    expect(measured.frames).toBeGreaterThan(15_000);
  });

  it('compares every car on track against its own telemetry', () => {
    expect(measured.samples).toBeGreaterThan(90_000);
    expect(measured.samplesWithoutTelemetry).toBe(0);
  });

  it('never reads a car moving faster than 80 km/h as slow or stopped', () => {
    expect(measured.falseSlow).toBe(0);
    expect(measured.falseStopped).toBe(0);
    expect(measured.slowestWhileMoving).toBeGreaterThan(SLOW_KMH);
  });

  it("stays within the averaging lag of each car's own speed", () => {
    expect(percentile(measured.absErrors, 0.99)).toBeLessThan(20);
    expect(measured.absErrors.at(-1)).toBeLessThan(25);
  });

  it('puts no car in a garage stall or pit box off pit road', () => {
    expect(measured.garageOffPitRoadFrames).toBe(0);
  });
});
