import type { TelemetryVariable, TelemetryVarList } from '../app/irsdk/types';

export type Telemetry = {
  [K in keyof TelemetryVarList]: Pick<TelemetryVarList[K], 'value'>;
} & {
  LmuCurrentSectorTimes?: TelemetryVar<(number | null)[]>;
  LmuLastSectorTimes?: TelemetryVar<(number | null)[]>;
  LmuBestSectorTimes?: TelemetryVar<(number | null)[]>;
  LmuSectorIdx?: TelemetryVar<number[]>;
  LmuCarIdxRelativeAvailable?: TelemetryVar<boolean[]>;
  LmuCarIdxRelativeLateral?: TelemetryVar<number[]>;
  LmuCarIdxRelativeLongitudinal?: TelemetryVar<number[]>;
  LmuCarIdxRelativeHeading?: TelemetryVar<number[]>;
  /** Fore(+)/aft(-) metres of the nearest car alongside; null when clear. */
  LmuBlindSpotLeftLongitudinal?: TelemetryVar<(number | null)[]>;
  LmuBlindSpotRightLongitudinal?: TelemetryVar<(number | null)[]>;
  /**
   * From LMU's local REST API rather than shared memory, so present only when
   * that API answers. Seconds.
   */
  LmuPitStopTime?: TelemetryVar<number[]>;
  LmuRepairTime?: TelemetryVar<number[]>;
  /**
   * What the next pit stop will add. Litres, or a virtual-energy percentage --
   * the companion flag says which, and nothing downstream should guess.
   */
  LmuRefuelTarget?: TelemetryVar<number[]>;
  LmuRefuelTargetIsVirtualEnergy?: TelemetryVar<boolean[]>;
  /** Wear and damage, 0..1. The four-element arrays are LF, RF, LR, RR. */
  LmuBrakeWear?: TelemetryVar<number[]>;
  LmuSuspensionDamage?: TelemetryVar<number[]>;
  LmuAeroDamage?: TelemetryVar<number[]>;
  /**
   * Body dent severity in display order FL,FC,FR,CL,CR,RL,RC,RR.
   * Values: 0 none, 1 light, 2 heavy, ≥3 detached (LMU forces rear-center to 3
   * when the body/rear wing is detached).
   */
  LmuDentSeverity?: TelemetryVar<number[]>;
  /** Per-wheel detached flags, LF, RF, LR, RR. */
  LmuWheelDetached?: TelemetryVar<boolean[]>;
  /** Any detachable body part off (LMU: rear wing). */
  LmuBodyDetached?: TelemetryVar<boolean[]>;
  /** Session time of the last impact, seconds. */
  LmuLastImpactET?: TelemetryVar<number[]>;
  /** Last impact position [x, y, z] in vehicle space. */
  LmuLastImpactPos?: TelemetryVar<number[]>;
  /**
   * From shared memory, not REST. Virtual energy remaining; the budget it
   * counts down from is LmuRest.maxVirtualEnergy on the session.
   */
  LmuVirtualEnergy?: TelemetryVar<number[]>;
  LmuStateOfCharge?: TelemetryVar<number[]>;
  LmuRegen?: TelemetryVar<number[]>;
  /**
   * iRacing Season 3+ — true when the car needs mandatory / optional repairs.
   * Not in every generated snapshot yet; optional so older builds still typecheck.
   */
  PitRepairNeeded?: TelemetryVar<boolean[]>;
  PitOptRepairNeeded?: TelemetryVar<boolean[]>;
};
/**
 * What SessionLapsRemain and SessionLapsTotal carry when the session has no
 * lap limit -- a timed practice, qualifying or endurance race.
 *
 * iRacing's own value: its captured frames read 32767 for both in a timed
 * session. Shared here because it is a contract between whoever produces a
 * telemetry frame and whoever reads it, and a producer that invents its own
 * "no limit" number is read as a real lap count.
 */
export const TIMED_SESSION_LAPS = 32767;

export type TelemetryVar<T extends (number | boolean | null)[]> = Pick<
  TelemetryVariable<T>,
  'value'
>;
