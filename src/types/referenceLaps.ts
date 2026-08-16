/**
 * A container for all timing data associated with a specific lap.
 * This can represent an active lap currently being recorded or a finalized "Best Lap". */
export interface ReferenceLap {
  pointPos: Float32Array;
  /** The times at each bucket index (Float32Array for memory efficiency) */
  times: Float32Array;
  /** The precomputed tangents at each bucket index (Float32Array for memory efficiency) */
  tangents: Float32Array;
  /**
   * Instantaneous speed in KM/H at each bucket index, sampled at the same
   * telemetry tick that wrote `times[i]` / `pointPos[i]` (so speed and position
   * pair with zero skew).
   *
   * Recorded for the player's car only — iRacing exposes no `CarIdxSpeed`, so
   * this is undefined on any opponent-sourced lap and on laps saved by releases
   * before this field existed.
   *
   * Buckets may be left at 0 if recording started mid-lap (before the player's
   * car index was known), so consumers must treat `speedsKph[i] <= 0` as "no
   * reference at this point" rather than as a literal 0 km/h.
   *
   * Note the unit: km/h, not the m/s of the raw `Speed` telemetry channel. The
   * field name carries the unit so no call site has to guess.
   */
  speedsKph?: Float32Array;
  /** The interval between points in track percentage (e.g. 10m / trackLength) */
  interval: number;
  /** Total number of buckets/points in this lap */
  pointsCount: number;
  startTime: number;
  finishTime: number;
  lastTrackedPct: number;
  isCleanLap: boolean;
}
