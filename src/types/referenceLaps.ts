/** Represents a single telemetry sample recorded at a specific distance around the track.
 * Used for interpolating time gaps between cars at different positions. */
export interface ReferencePoint {
  trackPct: number;
  timeElapsedSinceStart: number;
  tangent: number | undefined;
}

/**
 * A container for all timing data associated with a specific lap.
 * This can represent an active lap currently being recorded or a finalized "Best Lap". */
export interface ReferenceLap {
  pointPos: Float32Array;
  /** The times at each bucket index (Float32Array for memory efficiency) */
  times: Float32Array;
  /** The precomputed tangents at each bucket index (Float32Array for memory efficiency) */
  tangents: Float32Array;
  /** The interval between points in track percentage (e.g. 10m / trackLength) */
  interval: number;
  /** Total number of buckets/points in this lap */
  pointsCount: number;
  startTime: number;
  finishTime: number;
  lastTrackedPct: number;
  isCleanLap: boolean;
}

export interface ReferenceLapBridge {
  getReferenceLap: (
    seriesId: number,
    trackId: number,
    classId: number
  ) => Promise<ReferenceLap>;
  saveReferenceLap: (
    seriesId: number,
    trackId: number,
    classId: number,
    lap: ReferenceLap
  ) => Promise<void>;
}
