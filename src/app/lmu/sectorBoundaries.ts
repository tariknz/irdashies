const PIT_LANE_BIT = 0x80000000;
const SECTOR_MASK = 0x7fffffff;
const MIN_BOUNDARY = 0.02;
const MAX_BOUNDARY = 0.98;
const MIN_SECTOR_GAP = 0.02;
const MAX_FRAME_STEP = 0.01;
const MIN_STEADY_FRAMES = 10;

export class LmuSectorBoundaryLearner {
  private readonly learnedByTrack = new Map<string, readonly number[]>();
  private trackName = '';
  private published: readonly number[] | null = null;
  private pendingS2: number | null = null;
  private pendingS3: number | null = null;
  private lastSector: number | null = null;
  private lastPct: number | null = null;
  private steadyFrames = 0;

  reset(trackName: string): void {
    this.trackName = trackName;
    this.published = this.learnedByTrack.get(trackName) ?? null;
    this.pendingS2 = null;
    this.pendingS3 = null;
    this.lastSector = null;
    this.lastPct = null;
    this.steadyFrames = 0;
  }

  update(rawSector: number | undefined, lapPct: number | undefined): boolean {
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
      this.published !== null ||
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
    this.published = [this.pendingS2, this.pendingS3];
    this.learnedByTrack.set(this.trackName, this.published);
    return true;
  }

  boundaries(): readonly number[] | null {
    return this.published;
  }
}
