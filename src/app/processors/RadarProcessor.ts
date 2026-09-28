import type {
  RadarSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

/**
 * Replay fixtures and partial captures hand processors only the variables they
 * recorded, so every read has to tolerate a missing entry. The live SDK always
 * sends the full set, but the same code runs over recorded frames.
 */
const valuesOf = (frame: Telemetry, key: string): readonly unknown[] =>
  (frame as unknown as Record<string, { value?: unknown[] } | undefined>)[key]
    ?.value ?? [];

const scalar = (frame: Telemetry, key: string): unknown =>
  valuesOf(frame, key)[0];

/**
 * Copies one per-car number array at full precision. The radar places blips in
 * metres, so it cannot use the 3dp rounding the track-state channel applies:
 * 0.001 of a 25 km lap is 25 m of quantisation.
 *
 * Mutates the target in place: this runs on every frame and must not allocate.
 */
const copyNumbers = (target: number[], source: readonly unknown[]): boolean => {
  let changed = target.length !== source.length;
  target.length = source.length;
  for (let index = 0; index < source.length; index += 1) {
    const value = source[index];
    const normalised = typeof value === 'number' ? value : -1;
    if (target[index] !== normalised) changed = true;
    target[index] = normalised;
  }
  return changed;
};

const copyBooleans = (
  target: boolean[],
  source: readonly unknown[]
): boolean => {
  let changed = target.length !== source.length;
  target.length = source.length;
  for (let index = 0; index < source.length; index += 1) {
    const flag = source[index] === true;
    if (target[index] !== flag) changed = true;
    target[index] = flag;
  }
  return changed;
};

export class RadarProcessor implements TelemetryProcessor<RadarSnapshot> {
  readonly channel = 'radar.snapshot';
  readonly tickRateHz = 25;

  private readonly latest: RadarSnapshot = {
    focusCarIdx: null,
    carIdxLapDistPct: [],
    carIdxOnPitRoad: [],
    carIdxPosition: [],
    sessionState: 0,
    carSpeed: 0,
    isOnTrack: false,
    version: 0,
  };

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    let changed = false;

    // The radar centres on the car the camera follows — the player while
    // driving, the spectated car otherwise. -1 means "no camera car", so the
    // last valid index is kept rather than blanking the widget mid-switch.
    const camCarIdx = scalar(frame, 'CamCarIdx');
    if (
      typeof camCarIdx === 'number' &&
      camCarIdx >= 0 &&
      this.latest.focusCarIdx !== camCarIdx
    ) {
      this.latest.focusCarIdx = camCarIdx;
      changed = true;
    }

    const isOnTrack = scalar(frame, 'IsOnTrack') === true;
    if (this.latest.isOnTrack !== isOnTrack) {
      this.latest.isOnTrack = isOnTrack;
      changed = true;
    }

    const carSpeedValue = scalar(frame, 'Speed');
    const carSpeed =
      typeof carSpeedValue === 'number' && Number.isFinite(carSpeedValue)
        ? carSpeedValue
        : 0;
    if (this.latest.carSpeed !== carSpeed) {
      this.latest.carSpeed = carSpeed;
      changed = true;
    }
    changed =
      copyNumbers(
        this.latest.carIdxLapDistPct as number[],
        valuesOf(frame, 'CarIdxLapDistPct')
      ) || changed;
    changed =
      copyBooleans(
        this.latest.carIdxOnPitRoad as boolean[],
        valuesOf(frame, 'CarIdxOnPitRoad')
      ) || changed;
    // Before the start this ranking is the grid slot, so the radar can pair
    // the cars into rows from it. It settles for the whole session, so it is
    // copied like the positions rather than tracked per change.
    changed =
      copyNumbers(
        this.latest.carIdxPosition as number[],
        valuesOf(frame, 'CarIdxPosition')
      ) || changed;

    const sessionStateValue = scalar(frame, 'SessionState');
    const sessionState =
      typeof sessionStateValue === 'number' &&
      Number.isFinite(sessionStateValue)
        ? sessionStateValue
        : 0;
    if (this.latest.sessionState !== sessionState) {
      this.latest.sessionState = sessionState;
      changed = true;
    }

    if (changed) this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    (this.latest.carIdxLapDistPct as number[]).length = 0;
    (this.latest.carIdxOnPitRoad as boolean[]).length = 0;
    (this.latest.carIdxPosition as number[]).length = 0;
    this.latest.focusCarIdx = null;
    this.latest.sessionState = 0;
    this.latest.carSpeed = 0;
    this.latest.isOnTrack = false;
    this.latest.version += 1;
  }

  /**
   * @returns the live mutable snapshot; do not hold references across frames.
   * `onFrame` overwrites the arrays and fields in place and bumps `version`, so
   * a retained reference silently changes underneath the caller. Read it within
   * the tick, or copy what you need.
   */
  snapshot(): RadarSnapshot {
    return this.latest;
  }
}
