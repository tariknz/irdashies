import type { TelemetryVariable, TelemetryVarList } from '../app/irsdk/types';

export type Telemetry = {
  [K in keyof TelemetryVarList]: Pick<TelemetryVarList[K], 'value'>;
} & {
  LmuCurrentSectorTimes?: TelemetryVar<(number | null)[]>;
  LmuLastSectorTimes?: TelemetryVar<(number | null)[]>;
  LmuBestSectorTimes?: TelemetryVar<(number | null)[]>;
  LmuSectorIdx?: TelemetryVar<number[]>;
  /**
   * mLapInvalidated — the sim has voided the lap in progress. A bare flag:
   * LMU gives no reason with it, so nothing downstream should infer one.
   * Stands in for PlayerCarMyIncidentCount, which LMU does not publish.
   */
  LmuLapInvalidated?: TelemetryVar<boolean[]>;
  /**
   * True when that car has a relative position within 120 m of the focus
   * car. Empty (all false / absent) when the camera is on another car.
   */
  LmuCarIdxRelativeAvailable?: TelemetryVar<boolean[]>;
  LmuCarIdxRelativeLateral?: TelemetryVar<number[]>;
  LmuCarIdxRelativeLongitudinal?: TelemetryVar<number[]>;
  LmuCarIdxRelativeHeading?: TelemetryVar<number[]>;
  /**
   * Compound index per wheel, for every car: four entries per slot at
   * `carIdx * 4 + wheel`, in the sim's wheel order (FL, FR, RL, RR).
   *
   * Flat rather than nested because it rides the 60 Hz telemetry path, where
   * one array costs one allocation and an array of arrays costs one per car.
   * -1 means the car reported no telemetry that frame; 0 is a real compound.
   *
   * CarIdxTireCompound carries the front-left of each car, which is the one
   * value iRacing's shape has room for. This is here for the rest of it:
   * a car can be on four different compounds, and the standings say so.
   */
  LmuCarIdxWheelCompounds?: TelemetryVar<number[]>;
  /**
   * LMU's track-limits penalty points per car, in points rather than the
   * sim's own infringement steps. -1 where a car has no reading, or the
   * session has not stated the scale -- a clean car reads 0, and the two must
   * not look alike.
   */
  LmuCarIdxTrackLimitsPoints?: TelemetryVar<number[]>;
  /**
   * What each car has left to run on, 0..1, or -1 where neither budget reads.
   *
   * Virtual energy for a car that runs on it, fuel for one that does not --
   * the two are not comparable quantities, but only one of them limits any
   * given car, so one column can carry both. -1 is "no reading", which an
   * empty tank is not.
   */
  /**
   * Outstanding penalties per car. A count; scoring has no field for which
   * penalty it is.
   */
  LmuCarIdxPenalties?: TelemetryVar<number[]>;
  /**
   * Which penalty each car is serving, as an LMU_PENALTY_CODE.
   *
   * From LMU's UI websocket rather than shared memory or REST -- the only
   * source that names a kind, and the only one that names it for a car other
   * than the player. Empty when that socket is not answering, which is what
   * sends the player's badge back to the estimate-derived fallback and leaves
   * every other car without one. See app/lmu/liveStandings/.
   */
  LmuCarIdxPenaltyKind?: TelemetryVar<number[]>;
  /**
   * Each car's `mFinishStatus`: 0 none, 1 finished, 2 DNF, 3 DQ, as
   * LMU_FINISH_STATUS. From scoring, so it is there for every car.
   */
  LmuCarIdxFinishStatus?: TelemetryVar<number[]>;
  /**
   * Seconds a time penalty will add to each car's race time. 0 for a clean
   * car and for the two kinds that are served on track rather than paid in
   * time. From the same websocket as the kind above.
   */
  LmuCarIdxPenaltySeconds?: TelemetryVar<number[]>;
  /**
   * Seconds the player's next stop spends serving penalties, from the pit-stop
   * estimate. The only thing that tells a drive-through from a stop-go, since
   * the first costs no stationary time. See types/lmu/penalty.ts.
   */
  LmuPenaltySeconds?: TelemetryVar<number[]>;
  LmuCarIdxEnergyRemaining?: TelemetryVar<number[]>;
  /**
   * True when the sim has stopped writing shared memory, so this frame is the
   * last one it wrote rather than a current reading.
   *
   * Its own channel rather than being folded into the state fields it affects.
   * Gating those one at a time was wrong twice over: IsOnTrack went false but
   * the pit flags did not, and isDriving ORs the three together -- so a player
   * whose session ended in the pits stayed "driving". Falsifying IsInGarage
   * made it worse, because that is the term isDriving negates.
   */
  LmuDataStale?: TelemetryVar<boolean[]>;
  /**
   * True while LMU's GetGameState answers `{"status":"unavailable"}` or 404:
   * the sim is running and in no session, or in no game at all. Widgets read
   * it as Offline Testing for their session visibility, so only those allowed
   * there stay on screen. False whenever the game state is anything else or
   * unknown.
   */
  LmuNotInSession?: TelemetryVar<boolean[]>;
  /**
   * True while LMU's GetGameState says the player is not in the car: at the
   * monitor, or out of any session or game. The driving gate reads it before
   * the pit terms, which stay true for a car left in the pit lane or stall
   * while the player sits at the monitor. False whenever the game state is
   * unknown, so shared memory decides then.
   */
  LmuOutOfCar?: TelemetryVar<boolean[]>;
  /**
   * The points a drive-through is served at, 0 when the session has not said.
   *
   * A session constant, carried beside the per-car figure because neither is
   * readable without the other: 0.25 means nothing until it is 0.25 of three.
   */
  LmuTrackLimitsPointsMax?: TelemetryVar<number[]>;
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
   * Body dent severity in LMU's own order: FC, FL, CL, RL, RC, RR, CR, FR.
   * Values: 0 none, 1 light, 2 heavy, ≥3 detached. Display remapping belongs
   * in the damage widget.
   */
  LmuDentSeverity?: TelemetryVar<number[]>;
  /** Per-wheel detached flags, LF, RF, LR, RR. */
  LmuWheelDetached?: TelemetryVar<boolean[]>;
  /** Any detachable body part off (LMU: rear wing). */
  LmuBodyDetached?: TelemetryVar<boolean[]>;
  /** Session time of the last impact, seconds. */
  LmuLastImpactET?: TelemetryVar<number[]>;
  /**
   * Last impact position [x, y, z] in metres, vehicle local space
   * (x right, y up, z forward).
   */
  LmuLastImpactPos?: TelemetryVar<number[]>;
  /**
   * From shared memory, not REST. Virtual energy remaining; the budget it
   * counts down from is LmuRest.maxVirtualEnergy on the session.
   */
  LmuVirtualEnergy?: TelemetryVar<number[]>;
  LmuStateOfCharge?: TelemetryVar<number[]>;
  LmuRegen?: TelemetryVar<number[]>;
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
