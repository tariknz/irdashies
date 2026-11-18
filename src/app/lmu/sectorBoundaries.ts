const PIT_LANE_BIT = 0x80000000;
const SECTOR_MASK = 0x7fffffff;
const MIN_BOUNDARY = 0.02;
const MAX_BOUNDARY = 0.98;
const MIN_SECTOR_GAP = 0.02;
const MAX_FRAME_STEP = 0.01;
const MIN_STEADY_FRAMES = 10;

/** Where S2 and S3 start, as lap fractions. */
export type LmuSectorBoundaries = readonly [number, number];

/** Boundaries known before driving, and where a new measurement goes. */
export interface LmuSectorBoundarySources {
  known(trackKey: string): LmuSectorBoundaries | null;
  measured(trackKey: string, boundaries: LmuSectorBoundaries): void;
}

/** True when the pair is in order, inside the lap and not squeezed together. */
export const isPlausibleLmuSectorBoundaries = (
  s2: number,
  s3: number
): boolean =>
  Number.isFinite(s2) &&
  Number.isFinite(s3) &&
  s2 > MIN_BOUNDARY &&
  s3 < MAX_BOUNDARY &&
  s3 - s2 >= MIN_SECTOR_GAP;

/**
 * Learns where S2 and S3 start from the lap fraction at the player's 100 Hz
 * sector changes, since LMU publishes no boundary distances.
 *
 * A track starts on the boundaries measured earlier in this run, then on the
 * known ones (saved or bundled), then on none. Each track is measured once per
 * reset either way: the measurement is published only when nothing was known,
 * so timing never resets mid-session, and is handed to `measured` for next
 * time.
 */
export class LmuSectorBoundaryLearner {
  private readonly learnedByTrack = new Map<string, LmuSectorBoundaries>();
  private trackKey = '';
  private published: LmuSectorBoundaries | null = null;
  private measuredThisReset = false;
  private pendingS2: number | null = null;
  private pendingS3: number | null = null;
  private lastSector: number | null = null;
  private lastPct: number | null = null;
  private steadyFrames = 0;

  constructor(private readonly sources?: LmuSectorBoundarySources) {}

  /** Starts watching a track, with the best boundaries already known for it. */
  reset(trackKey: string): void {
    this.trackKey = trackKey;
    this.published =
      this.learnedByTrack.get(trackKey) ??
      this.sources?.known(trackKey) ??
      null;
    this.measuredThisReset = false;
    this.pendingS2 = null;
    this.pendingS3 = null;
    this.lastSector = null;
    this.lastPct = null;
    this.steadyFrames = 0;
  }

  /**
   * Feeds one frame: the player's raw `mCurrentSector` and the lap fraction
   * published on the same frame. True when the published boundaries changed.
   */
  update(rawSector: number | undefined, lapPct: number | undefined): boolean {
    if (this.measuredThisReset) return false;
    if (
      rawSector === undefined ||
      lapPct === undefined ||
      !Number.isFinite(rawSector) ||
      !Number.isFinite(lapPct)
    ) {
      this.lastSector = null;
      this.lastPct = null;
      this.steadyFrames = 0;
      return false;
    }

    const inPitLane = (rawSector & PIT_LANE_BIT) !== 0;
    const sector = rawSector & SECTOR_MASK;
    const previousSector = this.lastSector;
    const step = this.lastPct === null ? null : lapPct - this.lastPct;
    this.lastSector = inPitLane ? null : sector;
    this.lastPct = lapPct;
    const steady = step !== null && step >= 0 && step <= MAX_FRAME_STEP;
    const wasSteady = this.steadyFrames >= MIN_STEADY_FRAMES;
    this.steadyFrames = steady ? this.steadyFrames + 1 : 0;

    if (
      inPitLane ||
      previousSector === null ||
      !steady ||
      !wasSteady ||
      sector !== previousSector + 1 ||
      lapPct <= MIN_BOUNDARY ||
      lapPct >= MAX_BOUNDARY
    ) {
      return false;
    }

    if (sector === 1) {
      this.pendingS2 = lapPct;
      if (this.pendingS3 !== null && this.pendingS3 - lapPct < MIN_SECTOR_GAP)
        this.pendingS3 = null;
    } else if (sector === 2) {
      this.pendingS3 = lapPct;
      if (this.pendingS2 !== null && lapPct - this.pendingS2 < MIN_SECTOR_GAP)
        this.pendingS2 = null;
    } else {
      return false;
    }

    if (this.pendingS2 === null || this.pendingS3 === null) return false;
    const measurement: LmuSectorBoundaries = [this.pendingS2, this.pendingS3];
    this.measuredThisReset = true;
    this.learnedByTrack.set(this.trackKey, measurement);
    this.sources?.measured(this.trackKey, measurement);
    if (this.published !== null) return false;
    this.published = measurement;
    return true;
  }

  /** The start fractions of S2 and S3, or null until any are known. */
  boundaries(): LmuSectorBoundaries | null {
    return this.published;
  }
}
