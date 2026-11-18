/**
 * Every pit stop made by every car in the current session, published by
 * `PitStopRuntime` on `pit-stops.snapshot` when a stop starts, changes phase
 * or ends.
 *
 * Times are iRacing `SessionTime` seconds. A stop still in progress has a null
 * `exitTime`; consumers age it from `sessionTime`, the session clock when the
 * snapshot was published.
 */

/** Why the car ended up in the pits. */
export type PitStopKind =
  /** Drove down pit road. */
  | 'pit'
  /** Reset to the pit stall from the track. */
  | 'tow';

export interface PitStopRecord {
  /** Unique within the session; stops are listed oldest first. */
  id: number;
  carIdx: number;
  kind: PitStopKind;
  /** The lap the car was on when it entered pit road. */
  lap: number;
  entryTime: number;
  /** Null while the car is still on pit road. */
  exitTime: number | null;
  /** First time the car reached its stall; null if it never stopped there. */
  stallTime: number | null;
  /** Seconds spent in the stall on earlier visits during this stop. */
  stallSeconds: number;
  /** When the current visit to the stall began; null when not in it. */
  stallEnteredAt: number | null;
  /** Roster driver on entry. */
  driverIdIn: number | null;
  driverNameIn: string;
  /** Roster driver after the stop; settles shortly after exit. */
  driverIdOut: number | null;
  driverNameOut: string;
  classPositionIn: number;
  /** Zero while the stop is in progress. */
  classPositionOut: number;
  compoundIn: number;
  compoundOut: number;
  /** Fast repairs used during the stop. */
  fastRepairs: number;
}

export interface PitStopsSnapshot {
  /** The event, or null when no session is loaded. */
  subSessionId: number | null;
  sessionNum: number | null;
  /** Session clock when this snapshot was published. */
  sessionTime: number;
  stops: PitStopRecord[];
  version: number;
}

/** Stops kept per session; well above a 24-hour race's worth for 64 cars. */
export const PIT_STOP_CAPACITY = 4000;
