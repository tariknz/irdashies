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
  refPoints: Map<number, ReferencePoint>;
  startTime: number;
  finishTime: number;
  lastTrackedPct: number;
  isCleanLap: boolean;
  classId: number;
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
