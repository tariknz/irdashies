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
  sourceReplay?: boolean;
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

const booleanValue = (frame: Telemetry, key: keyof Telemetry): boolean => {
  const candidate = frame[key]?.value?.[0];
  return candidate === true || candidate === 1;
};

const values = (frame: Telemetry, key: keyof Telemetry): readonly number[] => {
  const candidates = frame[key]?.value;
  return Array.isArray(candidates)
    ? candidates.map((candidate) =>
        typeof candidate === 'number' && Number.isFinite(candidate)
          ? candidate
          : 0
      )
    : [];
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
  private aggregationEnabled = true;
  private session?: Session;
  private sourceReplay: boolean;
  private latest: FuelProjectionSnapshot;

  constructor(options: FuelProjectionProcessorOptions = {}) {
    this.persistence = options.persistence ?? noPersistence;
    this.persistLaps = options.persistLaps ?? false;
    this.sourceReplay = options.sourceReplay ?? false;
    this.engine = new FuelProjectionEngine(
      { now: options.clock ?? (() => this.clockMilliseconds) },
      { debug: () => undefined }
    );
    this.latest = this.emptySnapshot();
  }

  init(session: Session): void {
    this.session = session;
  }

  setSourceReplay(replay: boolean): void {
    this.sourceReplay = replay;
    this.latest = { ...this.latest, isReplay: replay };
  }

  onFrame(frame: Telemetry): void {
    if (!this.aggregationEnabled) return;
    const sessionTime = value(frame, 'SessionTime');
    this.clockMilliseconds = Math.round(sessionTime * 1000);
    const fuelLevel = value(frame, 'FuelLevel');
    const lap = value(frame, 'Lap');
    const lapDistPct = value(frame, 'LapDistPct');
    const sessionNum = value(frame, 'SessionNum');
    const sessionInfo = this.session?.SessionInfo?.Sessions?.find(
      (candidate) => candidate.SessionNum === sessionNum
    );
    const driverInfo = this.session?.DriverInfo;
    const maxFuel = driverInfo?.DriverCarFuelMaxLtr;
    const maxFuelPct = driverInfo?.DriverCarMaxFuelPct;
    const raceProjection = this.calculateRaceProjection(
      frame,
      sessionInfo?.SessionType,
      sessionInfo?.SessionLaps
    );
    const commands = this.engine.onFrame(
      {
        fuelLevel,
        lap,
        lapDistPct,
        onPitRoad: booleanValue(frame, 'OnPitRoad'),
        playerCarTowTime: value(frame, 'PlayerCarTowTime'),
        sessionFlags: value(frame, 'SessionFlags'),
        sessionNum,
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
      isReplay: this.sourceReplay,
      fuelLevel,
      fuelLevelPct: value(frame, 'FuelLevelPct'),
      currentLap: lap,
      lapDistPct,
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
      sessionLapsRemain: value(frame, 'SessionLapsRemain'),
      sessionTimeRemain: value(frame, 'SessionTimeRemain'),
      sessionTimeTotal: value(frame, 'SessionTimeTotal'),
      sessionFlags: value(frame, 'SessionFlags'),
      sessionState: value(frame, 'SessionState'),
      sessionNum,
      sessionLaps: sessionInfo?.SessionLaps ?? 0,
      calculatedTotalRaceLaps: raceProjection.totalRaceLaps,
      isFixedLapRace: raceProjection.isFixedLapRace,
      sessionType: sessionInfo?.SessionType,
      isOnTrack: booleanValue(frame, 'IsOnTrack'),
      trackId:
        this.session?.WeekendInfo?.TrackName ??
        this.session?.WeekendInfo?.TrackID,
      carName: driverInfo?.Drivers?.find(
        (driver) => driver.CarIdx === driverInfo.DriverCarIdx
      )?.CarPath,
      fuelTankCapacity:
        maxFuel !== undefined && maxFuelPct !== undefined
          ? maxFuel * maxFuelPct
          : maxFuel,
      completedLaps: this.laps,
      engine,
    };
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.reset();
      this.aggregationEnabled = !event.replay;
      return;
    }
    if (event.type === 'sessionNumChange') {
      this.reset();
      return;
    }
    this.reset();
    this.session = undefined;
    this.aggregationEnabled = false;
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
      isReplay: this.sourceReplay,
      fuelLevel: 0,
      fuelLevelPct: 0,
      currentLap: 0,
      lapDistPct: 0,
      currentLapUsage: 0,
      projectedLapUsage: 0,
      lastLapUsage: 0,
      sessionLapsRemain: 0,
      sessionTimeRemain: 0,
      sessionTimeTotal: 0,
      sessionFlags: 0,
      sessionState: 0,
      sessionNum: 0,
      sessionLaps: 0,
      calculatedTotalRaceLaps: 0,
      isFixedLapRace: false,
      isOnTrack: false,
      completedLaps: this.laps,
      engine: this.engine.snapshot(),
    };
  }

  private calculateRaceProjection(
    frame: Telemetry,
    sessionType?: string,
    sessionLaps?: string
  ): { totalRaceLaps: number; isFixedLapRace: boolean } {
    const timeRemaining = value(frame, 'SessionTimeRemain');
    const isFixedLapRace = !(timeRemaining > 0 && timeRemaining !== 604800);
    if (sessionType !== 'Race') return { totalRaceLaps: 0, isFixedLapRace };

    const driverCarIdx = this.session?.DriverInfo?.DriverCarIdx ?? 0;
    const cameraCarIdx = value(frame, 'CamCarIdx', -1);
    const playerCarIdx = cameraCarIdx >= 0 ? cameraCarIdx : driverCarIdx;
    const carLaps = values(frame, 'CarIdxLap');
    const positions = values(frame, 'CarIdxPosition');
    const lapDistances = values(frame, 'CarIdxLapDistPct');
    const playerLap = carLaps[playerCarIdx] ?? value(frame, 'Lap');
    let leaderCarIdx = -1;
    for (let index = 0; index < positions.length; index++) {
      if (positions[index] === 1) {
        leaderCarIdx = index;
        break;
      }
    }
    const projectionCarIdx = leaderCarIdx >= 0 ? leaderCarIdx : playerCarIdx;
    const classEstimate = this.session?.DriverInfo?.Drivers?.find(
      (driver) => driver.CarIdx === projectionCarIdx
    )?.CarClassEstLapTime;
    const bestLapTimes = values(frame, 'CarIdxBestLapTime');
    const averageLapTime =
      classEstimate && classEstimate > 0
        ? classEstimate
        : (bestLapTimes[playerCarIdx] ?? 0);
    const configuredLaps = Number.parseInt(sessionLaps ?? '0', 10) || 0;

    if (value(frame, 'SessionState') >= 5) {
      return { totalRaceLaps: playerLap, isFixedLapRace };
    }
    if (isFixedLapRace) {
      let totalRaceLaps = configuredLaps;
      const leaderLap = carLaps[leaderCarIdx] ?? 0;
      const leaderDistance = lapDistances[leaderCarIdx] ?? 0;
      const playerDistance = value(frame, 'LapDistPct');
      if (playerLap > 0 && leaderLap > 0) {
        const distanceBehind =
          leaderLap + leaderDistance - (playerLap + playerDistance);
        if (distanceBehind > 0) totalRaceLaps -= Math.floor(distanceBehind);
      }
      return { totalRaceLaps, isFixedLapRace };
    }
    if (averageLapTime <= 0) {
      return { totalRaceLaps: 0, isFixedLapRace };
    }

    const leaderLap = carLaps[leaderCarIdx] ?? playerLap;
    const leaderDistance = lapDistances[leaderCarIdx] ?? 0;
    const playerDistance =
      lapDistances[playerCarIdx] ?? value(frame, 'LapDistPct');
    let totalRaceLaps =
      playerLap === 0
        ? value(frame, 'SessionTimeTotal') / averageLapTime
        : timeRemaining / averageLapTime + (leaderLap - 1) + leaderDistance;
    const distanceBehind =
      leaderLap + leaderDistance - (playerLap + playerDistance);
    totalRaceLaps -= Math.max(0, Math.floor(distanceBehind));
    if (configuredLaps > 0 && totalRaceLaps > configuredLaps) {
      totalRaceLaps = configuredLaps;
    }
    return { totalRaceLaps, isFixedLapRace };
  }
}
