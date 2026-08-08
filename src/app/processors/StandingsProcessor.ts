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
  private lastUpdateTime: number | null = null;
  private enabled = true;
  private readonly actualTrackSurface: number[] = [];
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
    const sessionState = numberValue(frame, 'SessionState') ?? 0;
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
      version: 0,
    };
  }
}
