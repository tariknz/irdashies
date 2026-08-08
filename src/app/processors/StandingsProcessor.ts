import type {
  Session,
  SessionLifecycleEvent,
  StandingsSnapshot,
  Telemetry,
} from '@irdashies/types';
import { SessionState } from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const UPDATE_INTERVAL_SECONDS = 0.2;
const TIME_EPSILON = 1e-6;

const numberValue = (frame: Telemetry, key: keyof Telemetry): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const numberArray = (frame: Telemetry, key: keyof Telemetry): number[] => {
  const value = frame[key]?.value;
  return Array.isArray(value)
    ? value.map((entry) =>
        typeof entry === 'number' && Number.isFinite(entry) ? entry : 0
      )
    : [];
};

const booleanArray = (frame: Telemetry, key: keyof Telemetry): boolean[] => {
  const value = frame[key]?.value;
  return Array.isArray(value) ? value.map(Boolean) : [];
};

export class StandingsProcessor implements TelemetryProcessor<StandingsSnapshot> {
  readonly channel = 'standings.snapshot';
  readonly tickRateHz = 5;

  private driverCarIdx: number | null = null;
  private lastUpdateTime: number | null = null;
  private enabled = true;
  private pitLaps: number[] = [];
  private actualTrackSurface: number[] = [];
  private previousTrackSurface: number[] = [];
  private latest: StandingsSnapshot = this.emptySnapshot();

  init(session: Session): void {
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

    const carIdxOnPitRoad = booleanArray(frame, 'CarIdxOnPitRoad');
    const carIdxLap = numberArray(frame, 'CarIdxLap');
    const carIdxTrackSurface = numberArray(frame, 'CarIdxTrackSurface');
    const maxLength = Math.max(
      carIdxOnPitRoad.length,
      carIdxLap.length,
      carIdxTrackSurface.length
    );
    this.pitLaps.length = maxLength;
    this.previousTrackSurface.length = maxLength;
    this.actualTrackSurface.length = maxLength;
    const sessionState = numberValue(frame, 'SessionState') ?? 0;
    for (let carIdx = 0; carIdx < maxLength; carIdx += 1) {
      if (carIdxOnPitRoad[carIdx]) this.pitLaps[carIdx] = carIdxLap[carIdx];
      const surface = carIdxTrackSurface[carIdx] ?? -1;
      if (
        surface >= 0 &&
        sessionState < SessionState.Checkered &&
        this.actualTrackSurface[carIdx] !== surface
      ) {
        this.previousTrackSurface[carIdx] = this.actualTrackSurface[carIdx];
        this.actualTrackSurface[carIdx] = surface;
      }
    }

    this.latest = {
      focusCarIdx,
      sessionNum,
      carIdxF2Time: numberArray(frame, 'CarIdxF2Time'),
      carIdxEstTime: numberArray(frame, 'CarIdxEstTime'),
      carIdxOnPitRoad,
      carIdxLap,
      carIdxLapDistPct: numberArray(frame, 'CarIdxLapDistPct'),
      carIdxTrackSurface,
      carIdxTireCompound: numberArray(frame, 'CarIdxTireCompound'),
      carIdxSessionFlags: numberArray(frame, 'CarIdxSessionFlags'),
      lastPitLap: this.pitLaps.slice(),
      previousCarTrackSurface: this.previousTrackSurface.slice(),
      version: this.latest.version + 1,
    };
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
    this.pitLaps.length = 0;
    this.actualTrackSurface.length = 0;
    this.previousTrackSurface.length = 0;
    this.latest = { ...this.emptySnapshot(), sessionNum, version };
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
      version: 0,
    };
  }
}
