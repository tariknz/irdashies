import type {
  CarConditionSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';
import {
  assignField,
  CORNERS_CHANGED,
  CORNERS_PRESENT,
  cornerKeys,
  emptyCorners,
  flagOf,
  numberOf,
  syncCorners,
  syncList,
  valuesOf,
  type CornerKeys,
} from './carReadings';

type ScalarField =
  | 'steeringWheelAngleMax'
  | 'aeroDamage'
  | 'lmuRepairTime'
  | 'pitRepairLeft'
  | 'pitOptRepairLeft';

type FlagField = 'repairNeeded' | 'optRepairNeeded' | 'bodyDetached';

type CornerField = 'tyreTemperature' | 'tyrePressure' | 'tyreWear';

type ListField = 'dentSeverity' | 'wheelDetached' | 'suspensionDamage';

const SCALARS: readonly (readonly [ScalarField, string])[] = [
  ['steeringWheelAngleMax', 'SteeringWheelAngleMax'],
  ['aeroDamage', 'LmuAeroDamage'],
  ['lmuRepairTime', 'LmuRepairTime'],
  ['pitRepairLeft', 'PitRepairLeft'],
  ['pitOptRepairLeft', 'PitOptRepairLeft'],
];

const FLAGS: readonly (readonly [FlagField, string])[] = [
  ['repairNeeded', 'PitRepairNeeded'],
  ['optRepairNeeded', 'PitOptRepairNeeded'],
  ['bodyDetached', 'LmuBodyDetached'],
];

const CORNER_FIELDS: readonly (readonly [CornerField, CornerKeys])[] = [
  ['tyreTemperature', cornerKeys('tempCL', 'tempCM', 'tempCR')],
  ['tyrePressure', cornerKeys('coldPressure')],
  ['tyreWear', cornerKeys('wearL', 'wearM', 'wearR')],
];

const LISTS: readonly (readonly [ListField, string])[] = [
  ['dentSeverity', 'LmuDentSeverity'],
  ['wheelDetached', 'LmuWheelDetached'],
  ['suspensionDamage', 'LmuSuspensionDamage'],
];

export class CarConditionProcessor implements TelemetryProcessor<CarConditionSnapshot> {
  readonly channel = 'car-condition.snapshot';
  readonly tickRateHz = 5;

  private readonly latest: CarConditionSnapshot = { version: 0 };
  private readonly corners: Record<CornerField, (number | null)[]> = {
    tyreTemperature: emptyCorners(),
    tyrePressure: emptyCorners(),
    tyreWear: emptyCorners(),
  };
  private readonly lists: Record<ListField, unknown[]> = {
    dentSeverity: [],
    wheelDetached: [],
    suspensionDamage: [],
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
    for (const [field, key] of FLAGS) {
      changed = assignField(this.latest, field, flagOf(frame, key)) || changed;
    }
    for (const [field, keys] of CORNER_FIELDS) {
      const values = this.corners[field];
      const corners = syncCorners(frame, values, keys);
      changed =
        assignField(
          this.latest,
          field,
          corners & CORNERS_PRESENT ? values : undefined
        ) ||
        (corners & CORNERS_CHANGED) !== 0 ||
        changed;
    }
    for (const [field, key] of LISTS) {
      const source = valuesOf(frame, key);
      if (!source || source.length === 0) {
        changed = assignField(this.latest, field, undefined) || changed;
        continue;
      }
      const target = this.lists[field];
      const listChanged = syncList(target, source);
      changed =
        assignField(
          this.latest,
          field,
          target as CarConditionSnapshot[ListField]
        ) ||
        listChanged ||
        changed;
    }
    if (changed) this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    for (const [field] of SCALARS) this.latest[field] = undefined;
    for (const [field] of FLAGS) this.latest[field] = undefined;
    for (const [field] of CORNER_FIELDS) this.latest[field] = undefined;
    for (const [field] of LISTS) this.latest[field] = undefined;
    this.latest.version += 1;
  }

  snapshot(): CarConditionSnapshot {
    return this.latest;
  }
}
