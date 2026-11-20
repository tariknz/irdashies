import type {
  CarDynamicsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';
import {
  assignField,
  cornerKeys,
  emptyCorners,
  numberOf,
  syncCorners,
  type CornerKeys,
} from './carReadings';

type ScalarField =
  'sessionTime' | 'speed' | 'lateralAccel' | 'longitudinalAccel';

type CornerField = 'brakeLinePressure' | 'suspensionDeflection';

const SCALARS: readonly (readonly [ScalarField, string])[] = [
  ['sessionTime', 'SessionTime'],
  ['speed', 'Speed'],
  ['lateralAccel', 'LatAccel'],
  ['longitudinalAccel', 'LongAccel'],
];

const CORNER_FIELDS: readonly (readonly [CornerField, CornerKeys])[] = [
  ['brakeLinePressure', cornerKeys('brakeLinePress')],
  ['suspensionDeflection', cornerKeys('shockDefl')],
];

export class CarDynamicsProcessor implements TelemetryProcessor<CarDynamicsSnapshot> {
  readonly channel = 'car-dynamics.snapshot';
  readonly tickRateHz = 60;

  private readonly latest: CarDynamicsSnapshot = { version: 0 };
  private readonly corners: Record<CornerField, (number | null)[]> = {
    brakeLinePressure: emptyCorners(),
    suspensionDeflection: emptyCorners(),
  };

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    let changed = false;
    for (const [field, key] of SCALARS) {
      changed =
        assignField(this.latest, field, numberOf(frame, key)) || changed;
    }
    for (const [field, keys] of CORNER_FIELDS) {
      const values = this.corners[field];
      const corners = syncCorners(frame, values, keys);
      changed =
        assignField(this.latest, field, corners.present ? values : undefined) ||
        corners.changed ||
        changed;
    }
    if (changed) this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    for (const [field] of SCALARS) this.latest[field] = undefined;
    for (const [field] of CORNER_FIELDS) this.latest[field] = undefined;
    this.latest.version += 1;
  }

  snapshot(): CarDynamicsSnapshot {
    return this.latest;
  }
}
