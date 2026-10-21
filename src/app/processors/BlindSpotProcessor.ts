import type {
  BlindSpotSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import { CarLeftRight } from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const scalar = (frame: Telemetry, key: string): unknown =>
  (frame as unknown as Record<string, { value?: unknown[] } | undefined>)[key]
    ?.value?.[0];

const copyPositions = (target: number[], frame: Telemetry): boolean => {
  const source = frame.CarIdxLapDistPct?.value ?? [];
  let changed = target.length !== source.length;
  target.length = source.length;
  for (let index = 0; index < source.length; index += 1) {
    if (target[index] !== source[index]) changed = true;
    target[index] = source[index];
  }
  return changed;
};

export class BlindSpotProcessor implements TelemetryProcessor<BlindSpotSnapshot> {
  readonly channel = 'blind-spot.snapshot';
  readonly tickRateHz = 25;

  private readonly latest: BlindSpotSnapshot = {
    carLeftRight: 0,
    carIdxLapDistPct: [],
    leftLongitudinalM: null,
    rightLongitudinalM: null,
    isOnTrack: false,
    version: 0,
  };

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    const rawCarLeftRight = scalar(frame, 'CarLeftRight');
    const carLeftRight =
      typeof rawCarLeftRight === 'number' ? rawCarLeftRight : CarLeftRight.Off;
    const isOnTrack = scalar(frame, 'IsOnTrack');
    let changed = this.set('carLeftRight', carLeftRight);
    changed =
      this.set('isOnTrack', isOnTrack === true || isOnTrack === 1) || changed;

    // A sim that reports true relative positions gives metres directly. That
    // is both a better signal and a cheaper one: the lap-fraction array below
    // is over a hundred elements and would cross the channel every tick, and
    // the consumer would then have to search it to find the car alongside.
    const left = scalar(frame, 'LmuBlindSpotLeftLongitudinal');
    const right = scalar(frame, 'LmuBlindSpotRightLongitudinal');
    const hasOffsets = typeof left === 'number' || typeof right === 'number';
    changed =
      this.set('leftLongitudinalM', typeof left === 'number' ? left : null) ||
      changed;
    changed =
      this.set(
        'rightLongitudinalM',
        typeof right === 'number' ? right : null
      ) || changed;

    const positions = this.latest.carIdxLapDistPct as number[];
    if (!hasOffsets && carLeftRight > CarLeftRight.Clear) {
      changed = copyPositions(positions, frame) || changed;
    } else if (positions.length > 0) {
      positions.length = 0;
      changed = true;
    }

    if (changed) this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    (this.latest.carIdxLapDistPct as number[]).length = 0;
    this.latest.leftLongitudinalM = null;
    this.latest.rightLongitudinalM = null;
    this.latest.carLeftRight = 0;
    this.latest.isOnTrack = false;
    this.latest.version += 1;
  }

  snapshot(): BlindSpotSnapshot {
    return this.latest;
  }

  private set<
    K extends
      'carLeftRight' | 'isOnTrack' | 'leftLongitudinalM' | 'rightLongitudinalM',
  >(key: K, value: BlindSpotSnapshot[K]): boolean {
    if (this.latest[key] === value) return false;
    this.latest[key] = value;
    return true;
  }
}
