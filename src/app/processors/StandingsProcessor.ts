import type {
  Session,
  SessionLifecycleEvent,
  StandingsSnapshot,
  Telemetry,
} from '@irdashies/types';
import { SessionState, TrackLocation } from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const UPDATE_INTERVAL_SECONDS = 0.2;
const TIME_EPSILON = 1e-6;

const numberValue = (frame: Telemetry, key: keyof Telemetry): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const copyNumberArray = (
  frame: Telemetry,
  key: keyof Telemetry,
  target: number[]
): void => {
  const value = frame[key]?.value;
  if (!Array.isArray(value)) {
    target.length = 0;
    return;
  }
  target.length = value.length;
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    target[index] =
      typeof entry === 'number' && Number.isFinite(entry) ? entry : 0;
  }
};

const copyBooleanArray = (
  frame: Telemetry,
  key: keyof Telemetry,
  target: boolean[]
): void => {
  const value = frame[key]?.value;
  if (!Array.isArray(value)) {
    target.length = 0;
    return;
  }
  target.length = value.length;
  for (let index = 0; index < value.length; index += 1) {
    target[index] = Boolean(value[index]);
  }
};

export class StandingsProcessor implements TelemetryProcessor<StandingsSnapshot> {
  readonly channel = 'standings.snapshot';
  readonly tickRateHz = 5;

  private driverCarIdx: number | null = null;
  private session?: Session;
  private lastUpdateTime: number | null = null;
  private enabled = true;
  private readonly actualTrackSurface: number[] = [];
  private readonly classBuffers = new Map<number, number[]>();
  private readonly activeClassIds: number[] = [];
  private readonly resultClassPosition: number[] = [];
  private readonly resultLapsComplete: number[] = [];
  private resultsSessionNum: number | null = null;
  private readonly effectiveProgress: number[] = [];
  private readonly lastProgress: number[] = [];
  private readonly livePreviousSurface: (number | undefined)[] = [];
  private sortLaps: unknown[] = [];
  private sortSessionState = 0;
  private latest: StandingsSnapshot = this.emptySnapshot();

  init(session: Session): void {
    this.session = session;
    this.resultsSessionNum = null;
    const driverCarIdx = session.DriverInfo?.DriverCarIdx;
    this.driverCarIdx =
      typeof driverCarIdx === 'number' && driverCarIdx >= 0
        ? driverCarIdx
        : null;
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled) return;
    const sessionTime = numberValue(frame, 'SessionTime');
    if (sessionTime === null) return;
    const cameraCarIdx = numberValue(frame, 'CamCarIdx');
    const focusCarIdx =
      cameraCarIdx !== null && cameraCarIdx >= 0
        ? cameraCarIdx
        : this.driverCarIdx;
    const sessionNum = numberValue(frame, 'SessionNum');
    const lifecycleChanged =
      this.latest.sessionNum !== null && sessionNum !== this.latest.sessionNum;
    const focusChanged = focusCarIdx !== this.latest.focusCarIdx;
    const timeWentBackwards =
      this.lastUpdateTime !== null && sessionTime < this.lastUpdateTime;
    if (lifecycleChanged || timeWentBackwards) this.reset(sessionNum);
    if (
      !focusChanged &&
      !timeWentBackwards &&
      this.lastUpdateTime !== null &&
      sessionTime - this.lastUpdateTime < UPDATE_INTERVAL_SECONDS - TIME_EPSILON
    ) {
      return;
    }
    this.lastUpdateTime = sessionTime;

    copyBooleanArray(frame, 'CarIdxOnPitRoad', this.latest.carIdxOnPitRoad);
    copyNumberArray(frame, 'CarIdxLap', this.latest.carIdxLap);
    copyNumberArray(
      frame,
      'CarIdxTrackSurface',
      this.latest.carIdxTrackSurface
    );
    copyNumberArray(frame, 'CarIdxF2Time', this.latest.carIdxF2Time);
    copyNumberArray(frame, 'CarIdxEstTime', this.latest.carIdxEstTime);
    copyNumberArray(frame, 'CarIdxLapDistPct', this.latest.carIdxLapDistPct);
    copyNumberArray(
      frame,
      'CarIdxTireCompound',
      this.latest.carIdxTireCompound
    );
    copyNumberArray(
      frame,
      'CarIdxSessionFlags',
      this.latest.carIdxSessionFlags
    );
    const sessionState = numberValue(frame, 'SessionState') ?? 0;
    this.updateLiveClassPositions(frame, sessionNum, sessionState);
    const carIdxOnPitRoad = this.latest.carIdxOnPitRoad;
    const carIdxLap = this.latest.carIdxLap;
    const carIdxTrackSurface = this.latest.carIdxTrackSurface;
    const maxLength = Math.max(
      carIdxOnPitRoad.length,
      carIdxLap.length,
      carIdxTrackSurface.length
    );
    this.latest.lastPitLap.length = maxLength;
    this.latest.previousCarTrackSurface.length = maxLength;
    this.actualTrackSurface.length = maxLength;
    for (let carIdx = 0; carIdx < maxLength; carIdx += 1) {
      if (carIdxOnPitRoad[carIdx]) {
        this.latest.lastPitLap[carIdx] = carIdxLap[carIdx];
      }
      const surface = carIdxTrackSurface[carIdx] ?? -1;
      if (
        surface >= 0 &&
        sessionState < SessionState.Checkered &&
        this.actualTrackSurface[carIdx] !== surface
      ) {
        this.latest.previousCarTrackSurface[carIdx] =
          this.actualTrackSurface[carIdx];
        this.actualTrackSurface[carIdx] = surface;
      }
    }

    this.latest.focusCarIdx = focusCarIdx;
    this.latest.sessionNum = sessionNum;
    this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.enabled = !event.replay;
      if (event.replay) this.reset(null);
      return;
    }
    this.reset(null);
  }

  snapshot(): StandingsSnapshot {
    return this.latest;
  }

  private reset(sessionNum: number | null): void {
    const version = this.latest.version + 1;
    this.lastUpdateTime = null;
    this.actualTrackSurface.length = 0;
    this.activeClassIds.length = 0;
    this.classBuffers.forEach((buffer) => {
      buffer.length = 0;
    });
    this.effectiveProgress.length = 0;
    this.lastProgress.length = 0;
    this.livePreviousSurface.length = 0;
    this.resultsSessionNum = null;
    this.resultClassPosition.length = 0;
    this.resultLapsComplete.length = 0;
    this.latest.focusCarIdx = null;
    this.latest.sessionNum = sessionNum;
    this.latest.carIdxF2Time.length = 0;
    this.latest.carIdxEstTime.length = 0;
    this.latest.carIdxOnPitRoad.length = 0;
    this.latest.carIdxLap.length = 0;
    this.latest.carIdxLapDistPct.length = 0;
    this.latest.carIdxTrackSurface.length = 0;
    this.latest.carIdxTireCompound.length = 0;
    this.latest.carIdxSessionFlags.length = 0;
    this.latest.lastPitLap.length = 0;
    this.latest.previousCarTrackSurface.length = 0;
    this.latest.liveClassPosition.length = 0;
    this.latest.version = version;
  }

  private emptySnapshot(): StandingsSnapshot {
    return {
      focusCarIdx: null,
      sessionNum: null,
      carIdxF2Time: [],
      carIdxEstTime: [],
      carIdxOnPitRoad: [],
      carIdxLap: [],
      carIdxLapDistPct: [],
      carIdxTrackSurface: [],
      carIdxTireCompound: [],
      carIdxSessionFlags: [],
      lastPitLap: [],
      previousCarTrackSurface: [],
      liveClassPosition: [],
      version: 0,
    };
  }

  private updateLiveClassPositions(
    frame: Telemetry,
    sessionNum: number | null,
    sessionState: number
  ): void {
    const target = this.latest.liveClassPosition;
    target.length = 0;
    const session = this.session?.SessionInfo?.Sessions?.find(
      (entry) => entry.SessionNum === sessionNum
    );
    if (
      session?.SessionType !== 'Race' ||
      (sessionState !== SessionState.Racing &&
        sessionState !== SessionState.Checkered)
    ) {
      return;
    }
    if (this.resultsSessionNum !== sessionNum) {
      this.resultsSessionNum = sessionNum;
      this.resultClassPosition.length = 0;
      this.resultLapsComplete.length = 0;
      for (const result of session.ResultsPositions ?? []) {
        this.resultClassPosition[result.CarIdx] = result.ClassPosition;
        this.resultLapsComplete[result.CarIdx] = result.LapsComplete;
      }
    }

    const laps = frame.CarIdxLapCompleted?.value;
    const distances = frame.CarIdxLapDistPct?.value;
    const classes = frame.CarIdxClass?.value;
    const surfaces = frame.CarIdxTrackSurface?.value;
    if (
      !Array.isArray(laps) ||
      !Array.isArray(distances) ||
      !Array.isArray(classes)
    )
      return;
    const paceCarIdx = this.session?.DriverInfo?.PaceCarIdx ?? -1;
    this.activeClassIds.length = 0;
    this.classBuffers.forEach((buffer) => {
      buffer.length = 0;
    });
    for (let carIdx = 0; carIdx < laps.length; carIdx += 1) {
      if (carIdx === paceCarIdx) continue;
      const classId = Number(classes[carIdx] ?? -1);
      const distance = Number(distances[carIdx] ?? 0);
      const surface = Number(surfaces?.[carIdx] ?? TrackLocation.OnTrack);
      const previousSurface = this.livePreviousSurface[carIdx];
      const isTow =
        surface === TrackLocation.InPitStall &&
        previousSurface !== undefined &&
        previousSurface !== TrackLocation.ApproachingPits;
      if (surface !== previousSurface)
        this.livePreviousSurface[carIdx] = surface;
      const rawProgress = Number(laps[carIdx] ?? 0) + distance;
      if (isTow) {
        this.effectiveProgress[carIdx] =
          this.lastProgress[carIdx] ?? rawProgress;
      } else {
        this.lastProgress[carIdx] = rawProgress;
        this.effectiveProgress[carIdx] = rawProgress;
      }
      let drivers = this.classBuffers.get(classId);
      if (!drivers) {
        drivers = [];
        this.classBuffers.set(classId, drivers);
      }
      if (drivers.length === 0) this.activeClassIds.push(classId);
      drivers.push(carIdx);
    }
    if (this.activeClassIds.length === 1 && this.activeClassIds[0] === -1)
      return;

    this.sortLaps = laps;
    this.sortSessionState = sessionState;
    for (const classId of this.activeClassIds) {
      const drivers = this.classBuffers.get(classId);
      if (!drivers) continue;
      drivers.sort(this.compareDrivers);
      for (let index = 0; index < drivers.length; index += 1) {
        target[drivers[index]] = index + 1;
      }
    }
  }

  private readonly compareDrivers = (a: number, b: number): number => {
    const aLap = Number(this.sortLaps[a] ?? -1);
    const bLap = Number(this.sortLaps[b] ?? -1);
    const aCompleted = aLap === -1 ? (this.resultLapsComplete[a] ?? -1) : aLap;
    const bCompleted = bLap === -1 ? (this.resultLapsComplete[b] ?? -1) : bLap;
    if (aCompleted !== bCompleted) return bCompleted - aCompleted;
    if (this.sortSessionState === SessionState.Checkered) {
      const aPosition = this.resultClassPosition[a] ?? Number.MAX_SAFE_INTEGER;
      const bPosition = this.resultClassPosition[b] ?? Number.MAX_SAFE_INTEGER;
      if (aPosition !== bPosition) return aPosition - bPosition;
    }
    return this.effectiveProgress[b] - this.effectiveProgress[a];
  };
}
