import type {
  FuelLapData,
  FuelProjectionSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import {
  FuelProjectionEngine,
  type FuelEngineCommand,
} from '@irdashies/shared';
import type { TelemetryProcessor } from './TelemetryProcessor';

const MAX_LAP_HISTORY = 50;

export interface FuelProjectionPersistence {
  lapCompleted(lap: FuelLapData): void;
  saveLap(lap: FuelLapData): void;
}

export interface FuelProjectionProcessorOptions {
  persistence?: FuelProjectionPersistence;
  persistLaps?: boolean;
  clock?: () => number;
}

const noPersistence: FuelProjectionPersistence = {
  lapCompleted: () => undefined,
  saveLap: () => undefined,
};

const value = (
  frame: Telemetry,
  key: keyof Telemetry,
  fallback = 0
): number => {
  const candidate = frame[key]?.value?.[0];
  return typeof candidate === 'number' ? candidate : fallback;
};

const isGreenFlag = (flags: number): boolean =>
  (flags & (0x00004000 | 0x00008000 | 0x00010000)) === 0;

const validateLap = (
  fuelUsed: number,
  lapTime: number,
  recentLaps: FuelLapData[]
): boolean => {
  if (fuelUsed <= 0 || lapTime <= 0) return false;
  const valid = recentLaps.filter((lap) => lap.isValidForCalc);
  if (valid.length < 3) return true;
  const fuels = valid.map((lap) => lap.fuelUsed).sort((a, b) => a - b);
  const q1 = fuels[Math.floor(fuels.length * 0.25)];
  const q3 = fuels[Math.floor(fuels.length * 0.75)];
  const iqr = q3 - q1;
  const mean = fuels.reduce((sum, fuel) => sum + fuel, 0) / fuels.length;
  return (
    (fuelUsed >= q1 - 2 * iqr && fuelUsed <= q3 + 2 * iqr) ||
    Math.abs(fuelUsed - mean) <= mean * 0.15
  );
};

export class FuelProjectionProcessor implements TelemetryProcessor<FuelProjectionSnapshot> {
  readonly channel = 'fuel.projection';
  readonly tickRateHz = 5;

  private clockMilliseconds = 0;
  private readonly engine: FuelProjectionEngine;
  private readonly laps: FuelLapData[] = [];
  private readonly persistence: FuelProjectionPersistence;
  private readonly persistLaps: boolean;
  private lastCommands: readonly FuelEngineCommand[] = [];
  private latest: FuelProjectionSnapshot;

  constructor(options: FuelProjectionProcessorOptions = {}) {
    this.persistence = options.persistence ?? noPersistence;
    this.persistLaps = options.persistLaps ?? false;
    this.engine = new FuelProjectionEngine(
      { now: options.clock ?? (() => this.clockMilliseconds) },
      { debug: () => undefined }
    );
    this.latest = this.emptySnapshot();
  }

  init(session: Session): void {
    // Session fields needed by the complete renderer projection are added when
    // the Fuel widget migrates. The deterministic lap engine is frame-driven.
    void session;
  }

  onFrame(frame: Telemetry): void {
    const sessionTime = value(frame, 'SessionTime');
    this.clockMilliseconds = Math.round(sessionTime * 1000);
    const fuelLevel = value(frame, 'FuelLevel');
    const lap = value(frame, 'Lap');
    const lapDistPct = value(frame, 'LapDistPct');
    const commands = this.engine.onFrame(
      {
        fuelLevel,
        lap,
        lapDistPct,
        onPitRoad: Boolean(value(frame, 'OnPitRoad')),
        playerCarTowTime: value(frame, 'PlayerCarTowTime'),
        sessionFlags: value(frame, 'SessionFlags'),
        sessionNum: value(frame, 'SessionNum'),
        sessionTime,
      },
      { getRecentLaps: (count) => this.laps.slice(0, count) },
      validateLap,
      isGreenFlag,
      { persistLaps: this.persistLaps }
    );
    this.lastCommands = commands;
    this.execute(commands);

    const engine = this.engine.snapshot();
    const currentLapUsage =
      engine.lapStartFuel > 0
        ? Math.max(0, engine.lapStartFuel - fuelLevel)
        : 0;
    const validLaps = this.laps.filter((completed) => completed.isValidForCalc);
    const average = validLaps.length
      ? validLaps.reduce((sum, completed) => sum + completed.fuelUsed, 0) /
        validLaps.length
      : 0;
    this.latest = {
      fuelLevel,
      currentLap: lap,
      currentLapUsage,
      projectedLapUsage: this.engine.project({
        avgConsumption: average,
        currentFuel: fuelLevel,
        currentLapUsage,
        lap,
        lapDistPct,
        lapStartFuel: engine.lapStartFuel,
        lastLapUsage: this.laps[0]?.fuelUsed ?? 0,
        qualifyConsumption: null,
      }),
      lastLapUsage: this.laps[0]?.fuelUsed ?? 0,
      completedLaps: this.laps,
      engine,
    };
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'disconnect') this.reset();
  }

  snapshot(): FuelProjectionSnapshot {
    return this.latest;
  }

  validationSnapshot(): {
    commands: readonly FuelEngineCommand[];
    state: ReturnType<FuelProjectionEngine['snapshot']>;
  } {
    return { commands: this.lastCommands, state: this.engine.snapshot() };
  }

  private execute(commands: readonly FuelEngineCommand[]): void {
    for (const command of commands) {
      if (command.type === 'lapCompleted') {
        this.laps.unshift(command.lap);
        if (this.laps.length > MAX_LAP_HISTORY) this.laps.pop();
        this.persistence.lapCompleted(command.lap);
      } else {
        this.persistence.saveLap(command.lap);
      }
    }
  }

  private reset(): void {
    this.engine.reset();
    this.lastCommands = [];
    this.laps.length = 0;
    this.latest = this.emptySnapshot();
  }

  private emptySnapshot(): FuelProjectionSnapshot {
    return {
      fuelLevel: 0,
      currentLap: 0,
      currentLapUsage: 0,
      projectedLapUsage: 0,
      lastLapUsage: 0,
      completedLaps: this.laps,
      engine: this.engine.snapshot(),
    };
  }
}
