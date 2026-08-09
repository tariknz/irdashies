import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
  TrackStateSnapshot,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const value = (frame: Telemetry, key: string): unknown =>
  (frame as unknown as Record<string, { value?: unknown[] } | undefined>)[key]
    ?.value?.[0];

const numberValue = (frame: Telemetry, key: string, fallback = 0): number => {
  const current = value(frame, key);
  return typeof current === 'number' ? current : fallback;
};

const booleanValue = (frame: Telemetry, key: string): boolean => {
  const current = value(frame, key);
  return current === true || current === 1;
};

const arrayValue = <T>(frame: Telemetry, key: string): readonly T[] => {
  const current = (
    frame as unknown as Record<string, { value?: unknown[] } | undefined>
  )[key]?.value;
  return Array.isArray(current) ? (current as readonly T[]) : [];
};

const copyArray = <T>(target: T[], source: readonly T[]): boolean => {
  let changed = target.length !== source.length;
  if (target.length !== source.length) target.length = source.length;
  for (let index = 0; index < source.length; index += 1) {
    if (target[index] !== source[index]) changed = true;
    target[index] = source[index];
  }
  return changed;
};

const copyBooleanArray = (
  target: boolean[],
  source: readonly unknown[]
): boolean => {
  let changed = target.length !== source.length;
  if (target.length !== source.length) target.length = source.length;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index] === true || source[index] === 1;
    if (target[index] !== current) changed = true;
    target[index] = current;
  }
  return changed;
};

const copyRoundedPositionArray = (
  target: number[],
  source: readonly number[]
): boolean => {
  let changed = target.length !== source.length;
  if (target.length !== source.length) target.length = source.length;
  for (let index = 0; index < source.length; index += 1) {
    const current = Math.round(source[index] * 1000) / 1000;
    if (target[index] !== current) changed = true;
    target[index] = current;
  }
  return changed;
};

export class TrackStateProcessor implements TelemetryProcessor<TrackStateSnapshot> {
  readonly channel = 'track-state.snapshot';
  readonly tickRateHz = 25;

  private readonly latest: TrackStateSnapshot = {
    focusCarIdx: null,
    carIdxLapDistPct: [],
    carIdxOnPitRoad: [],
    carIdxTrackSurface: [],
    carIdxClassPosition: [],
    carLeftRight: 0,
    isOnTrack: false,
    playerCarInPitStall: false,
    playerTrackSurface: 0,
    onPitRoad: false,
    isInGarage: false,
    isGarageVisible: false,
    isReplayPlaying: false,
    sessionTime: 0,
    sessionState: 0,
    sessionFlags: 0,
    speed: 0,
    displayUnits: 0,
    pitSpeedLimiterToggle: false,
    pitstopActive: false,
    engineWarnings: 0,
    lapDistPct: 0,
    sessionNum: null,
    version: 0,
  };

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    let changed = false;
    changed =
      copyRoundedPositionArray(
        this.latest.carIdxLapDistPct as number[],
        arrayValue<number>(frame, 'CarIdxLapDistPct')
      ) || changed;
    changed =
      copyBooleanArray(
        this.latest.carIdxOnPitRoad as boolean[],
        arrayValue(frame, 'CarIdxOnPitRoad')
      ) || changed;
    changed =
      copyArray(
        this.latest.carIdxTrackSurface as number[],
        arrayValue<number>(frame, 'CarIdxTrackSurface')
      ) || changed;
    changed =
      copyArray(
        this.latest.carIdxClassPosition as number[],
        arrayValue<number>(frame, 'CarIdxClassPosition')
      ) || changed;
    changed =
      this.set('focusCarIdx', numberValue(frame, 'CamCarIdx', -1)) || changed;
    changed =
      this.set('carLeftRight', numberValue(frame, 'CarLeftRight')) || changed;
    changed =
      this.set('isOnTrack', booleanValue(frame, 'IsOnTrack')) || changed;
    changed =
      this.set(
        'playerCarInPitStall',
        booleanValue(frame, 'PlayerCarInPitStall')
      ) || changed;
    changed =
      this.set(
        'playerTrackSurface',
        numberValue(frame, 'PlayerTrackSurface')
      ) || changed;
    changed =
      this.set('onPitRoad', booleanValue(frame, 'OnPitRoad')) || changed;
    changed =
      this.set('isInGarage', booleanValue(frame, 'IsInGarage')) || changed;
    changed =
      this.set('isGarageVisible', booleanValue(frame, 'IsGarageVisible')) ||
      changed;
    changed =
      this.set('isReplayPlaying', booleanValue(frame, 'IsReplayPlaying')) ||
      changed;
    changed =
      this.set('sessionTime', numberValue(frame, 'SessionTime')) || changed;
    changed =
      this.set('sessionState', numberValue(frame, 'SessionState')) || changed;
    changed =
      this.set('sessionFlags', numberValue(frame, 'SessionFlags')) || changed;
    changed = this.set('speed', numberValue(frame, 'Speed')) || changed;
    changed =
      this.set('displayUnits', numberValue(frame, 'DisplayUnits')) || changed;
    changed =
      this.set(
        'pitSpeedLimiterToggle',
        booleanValue(frame, 'dcPitSpeedLimiterToggle')
      ) || changed;
    changed =
      this.set('pitstopActive', booleanValue(frame, 'PitstopActive')) ||
      changed;
    changed =
      this.set('engineWarnings', numberValue(frame, 'EngineWarnings')) ||
      changed;
    changed =
      this.set('lapDistPct', numberValue(frame, 'LapDistPct')) || changed;
    changed =
      this.set('sessionNum', numberValue(frame, 'SessionNum')) || changed;
    if (changed) this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    (this.latest.carIdxLapDistPct as number[]).length = 0;
    (this.latest.carIdxOnPitRoad as boolean[]).length = 0;
    (this.latest.carIdxTrackSurface as number[]).length = 0;
    (this.latest.carIdxClassPosition as number[]).length = 0;
    this.latest.focusCarIdx = null;
    this.latest.carLeftRight = 0;
    this.latest.isOnTrack = false;
    this.latest.playerCarInPitStall = false;
    this.latest.playerTrackSurface = 0;
    this.latest.onPitRoad = false;
    this.latest.isInGarage = false;
    this.latest.isGarageVisible = false;
    this.latest.isReplayPlaying = false;
    this.latest.sessionTime = 0;
    this.latest.sessionState = 0;
    this.latest.sessionFlags = 0;
    this.latest.speed = 0;
    this.latest.displayUnits = 0;
    this.latest.pitSpeedLimiterToggle = false;
    this.latest.pitstopActive = false;
    this.latest.engineWarnings = 0;
    this.latest.lapDistPct = 0;
    this.latest.sessionNum = null;
    this.latest.version += 1;
  }

  snapshot(): TrackStateSnapshot {
    return this.latest;
  }

  private set<
    K extends Exclude<
      keyof TrackStateSnapshot,
      | 'version'
      | 'carIdxLapDistPct'
      | 'carIdxOnPitRoad'
      | 'carIdxTrackSurface'
      | 'carIdxClassPosition'
    >,
  >(key: K, current: TrackStateSnapshot[K]): boolean {
    if (this.latest[key] === current) return false;
    this.latest[key] = current;
    return true;
  }
}
