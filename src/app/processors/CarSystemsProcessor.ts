import type {
  CarSystemAdjustment,
  CarSystemsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import { CAR_SYSTEM_ADJUSTMENTS } from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const number = (frame: Telemetry, key: string): number | undefined => {
  const value = (frame as Record<string, { value?: unknown[] } | undefined>)[
    key
  ]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const boolean = (frame: Telemetry, key: keyof Telemetry): boolean =>
  (frame[key] as { value?: unknown[] } | undefined)?.value?.[0] === true;

/**
 * Publishes the player car's adjustable systems.
 *
 * Two things drive the design, both established from recorded sessions rather
 * than assumed:
 *
 * **The set is per-car and is only visible from inside the car.** A Formula Vee
 * exposes brake bias alone; a GTP car exposes a dozen. Out of the car iRacing
 * publishes a reduced set — sessions captured while spectating carry only
 * dcStarter — so an out-of-car frame cannot be used to conclude that a car
 * lacks ABS. The discovered set is therefore latched on the first in-car frame
 * and kept, so the display does not empty out when the player hops out, spectates
 * or watches a replay.
 *
 * **Scales differ and some are signed.** Most run 0..n with 0 meaning off, but
 * the BMW M Hybrid V8 reports ABS between -5 and -3. A negative value anywhere
 * in a session proves the scale has a negative side, on which 0 is an ordinary
 * setting rather than off. That is tracked per variable.
 */
export class CarSystemsProcessor implements TelemetryProcessor<CarSystemsSnapshot> {
  readonly channel = 'car-systems.snapshot';
  // Adjustments move when a dial is turned. Sampling faster buys nothing and
  // the snapshot only republishes when a value actually changes.
  readonly tickRateHz = 10;

  private enabled = true;
  /** Variables seen on an in-car frame, in CAR_SYSTEM_ADJUSTMENTS order. */
  private discoveredKeys: string[] = [];
  /** Variables observed negative at any point: their scale is signed. */
  private readonly signedKeys = new Set<string>();
  private readonly latest: CarSystemsSnapshot & {
    adjustments: CarSystemAdjustment[];
  } = {
    adjustments: [],
    discovered: false,
    sessionNum: null,
    version: 0,
  };

  // The adjustment set is discovered from telemetry, not from session info.
  init(session: Session): void {
    void session;
    this.reset(null);
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled) return;

    const sessionNum = number(frame, 'SessionNum') ?? null;
    if (
      this.latest.sessionNum !== null &&
      sessionNum !== this.latest.sessionNum
    ) {
      this.reset(sessionNum);
    } else if (this.latest.sessionNum === null) {
      this.latest.sessionNum = sessionNum;
    }

    // Being in the car is what makes the full set visible. The pit box counts;
    // the garage and replay playback do not, matching useDrivingState.
    const inCar =
      (boolean(frame, 'IsOnTrack') ||
        boolean(frame, 'PlayerCarInPitStall') ||
        boolean(frame, 'OnPitRoad')) &&
      !boolean(frame, 'IsInGarage') &&
      !boolean(frame, 'IsReplayPlaying');

    if (inCar) {
      const present = CAR_SYSTEM_ADJUSTMENTS.filter(
        ({ key }) => number(frame, key) !== undefined
      ).map(({ key }) => key);
      // Union rather than replacement: a car can publish a variable a frame
      // later than the rest, and losing a row mid-session reads as a fault.
      for (const key of present) {
        if (!this.discoveredKeys.includes(key)) this.discoveredKeys.push(key);
      }
      if (present.length > 0) this.latest.discovered = true;
    }

    if (!this.latest.discovered) return;

    const next: CarSystemAdjustment[] = [];
    for (const definition of CAR_SYSTEM_ADJUSTMENTS) {
      if (!this.discoveredKeys.includes(definition.key)) continue;
      const value = number(frame, definition.key);
      if (value === undefined) {
        // Out of the car the value stops being published. Keep the last known
        // reading rather than dropping the row.
        const previous = this.latest.adjustments.find(
          (a) => a.key === definition.key
        );
        if (previous) next.push(previous);
        continue;
      }
      if (value < 0) this.signedKeys.add(definition.key);
      next.push({
        key: definition.key,
        label: definition.label,
        value,
        isOff: value === 0 && !this.signedKeys.has(definition.key),
        precision: definition.precision,
        unit: definition.unit,
      });
    }

    if (this.changed(next)) {
      this.latest.adjustments = next;
      this.latest.version += 1;
    }
  }

  private changed(next: CarSystemAdjustment[]): boolean {
    const current = this.latest.adjustments;
    if (current.length !== next.length) return true;
    for (let i = 0; i < next.length; i += 1) {
      const a = current[i];
      const b = next[i];
      if (a.key !== b.key || a.value !== b.value || a.isOff !== b.isOff) {
        return true;
      }
    }
    return false;
  }

  private reset(sessionNum: number | null): void {
    this.discoveredKeys = [];
    this.signedKeys.clear();
    this.latest.adjustments = [];
    this.latest.discovered = false;
    this.latest.sessionNum = sessionNum;
    this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      // Scrubbing a replay replays old adjustment values, and the discovered
      // set would latch from whatever car the replay is following rather than
      // the player's. Neither is useful, so recording stops during one.
      this.enabled = !event.replay;
      if (event.replay) this.reset(null);
    } else {
      this.reset(null);
    }
  }

  snapshot(): CarSystemsSnapshot {
    return this.latest;
  }
}
