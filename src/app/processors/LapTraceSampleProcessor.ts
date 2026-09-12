import type {
  LapTraceSampleSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const rawValue = (frame: Telemetry, key: string): unknown =>
  (frame as unknown as Record<string, { value?: unknown[] } | undefined>)[key]
    ?.value?.[0];

const numberValue = (
  frame: Telemetry,
  key: string,
  fallback: number
): number => {
  const current = rawValue(frame, key);
  return typeof current === 'number' ? current : fallback;
};

const booleanValue = (frame: Telemetry, key: string): boolean => {
  const current = rawValue(frame, key);
  return current === true || current === 1;
};

const defaults = (): LapTraceSampleSnapshot => ({
  sessionTime: -1,
  lapDistPct: -1,
  throttle: 0,
  brake: 0,
  speed: 0,
  gear: 0,
  brakeAbsActive: false,
  onPitRoad: false,
  isOnTrack: false,
  sessionNum: null,
  lastLapTime: 0,
  lapCompleted: 0,
  incidentCount: 0,
  version: 0,
});

/**
 * Feeds the LapTrace recorder one co-sampled row per telemetry frame.
 *
 * Exists because the recorder needs pedals AND position from the same frame:
 * taking throttle/brake from driver-controls and LapDistPct from track-state
 * pairs each pedal sample with a position up to a delivery interval stale.
 * Reading everything here, from one frame, gives the live lap the same
 * per-row integrity as an .ibt file.
 */
export class LapTraceSampleProcessor implements TelemetryProcessor<LapTraceSampleSnapshot> {
  readonly channel = 'lap-trace.sample';
  readonly tickRateHz = 60;

  private readonly latest: LapTraceSampleSnapshot = defaults();

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    // SessionTime alone never counts as a change: a parked car with the clock
    // running would otherwise publish 60 identical samples a second.
    this.latest.sessionTime = numberValue(frame, 'SessionTime', -1);

    let changed = false;
    changed =
      this.set('lapDistPct', numberValue(frame, 'LapDistPct', -1)) || changed;
    // Raw pedal position, not the processed channel: the trace is there to
    // show what the driver's feet did, without iRacing's assists smoothing it.
    // The processed value stands in only if the sim did not publish a raw one.
    changed =
      this.set(
        'throttle',
        numberValue(frame, 'ThrottleRaw', numberValue(frame, 'Throttle', 0))
      ) || changed;
    changed =
      this.set(
        'brake',
        numberValue(frame, 'BrakeRaw', numberValue(frame, 'Brake', 0))
      ) || changed;
    changed = this.set('speed', numberValue(frame, 'Speed', 0)) || changed;
    changed = this.set('gear', numberValue(frame, 'Gear', 0)) || changed;
    changed =
      this.set('brakeAbsActive', booleanValue(frame, 'BrakeABSactive')) ||
      changed;
    changed =
      this.set('onPitRoad', booleanValue(frame, 'OnPitRoad')) || changed;
    changed =
      this.set('isOnTrack', booleanValue(frame, 'IsOnTrack')) || changed;
    changed =
      this.set('sessionNum', numberValue(frame, 'SessionNum', -1)) || changed;
    changed =
      this.set('lastLapTime', numberValue(frame, 'LapLastLapTime', 0)) ||
      changed;
    changed =
      this.set('lapCompleted', numberValue(frame, 'LapCompleted', 0)) ||
      changed;
    changed =
      this.set(
        'incidentCount',
        numberValue(frame, 'PlayerCarMyIncidentCount', 0)
      ) || changed;
    if (changed) this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    // lapDistPct -1 is the recorder's "no position yet" sentinel, so a reset
    // reads as a fresh start rather than a teleport to the line.
    Object.assign(this.latest, defaults(), {
      version: this.latest.version + 1,
    });
  }

  snapshot(): LapTraceSampleSnapshot {
    return this.latest;
  }

  private set<
    K extends Exclude<keyof LapTraceSampleSnapshot, 'version' | 'sessionTime'>,
  >(key: K, value: LapTraceSampleSnapshot[K]): boolean {
    if (this.latest[key] === value) return false;
    this.latest[key] = value;
    return true;
  }
}
