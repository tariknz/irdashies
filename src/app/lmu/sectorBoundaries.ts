const PIT_LANE_BIT = 0x80000000;
const SECTOR_MASK = 0x7fffffff;
const MIN_BOUNDARY = 0.02;
const MAX_BOUNDARY = 0.98;
const MIN_SECTOR_GAP = 0.02;
const MAX_FRAME_STEP = 0.01;
const MIN_STEADY_FRAMES = 10;
const AGREEMENT_TOLERANCE = 0.002;

export class LmuSectorBoundaryLearner {
  private readonly learnedByTrack = new Map<string, readonly number[]>();
  private readonly lastCrossing: (number | null)[] = [null, null];
  private readonly confirmed: (number | null)[] = [null, null];
  private trackName = '';
  private published: readonly number[] | null = null;
  private lastSector: number | null = null;
  private lastPct: number | null = null;
  private steadyFrames = 0;

  reset(trackName: string): void {
    this.trackName = trackName;
    this.published = this.learnedByTrack.get(trackName) ?? null;
    this.lastCrossing.fill(null);
    this.confirmed.fill(null);
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
      inPitLane ||
      previousSector === null ||
      !steady ||
      !wasSteady ||
      (sector !== 1 && sector !== 2) ||
      sector !== previousSector + 1 ||
      lapPct <= MIN_BOUNDARY ||
      lapPct >= MAX_BOUNDARY
    ) {
      return false;
    }

    const boundary = sector - 1;
    const previousCrossing = this.lastCrossing[boundary];
    this.lastCrossing[boundary] = lapPct;
    if (
      previousCrossing === null ||
      Math.abs(lapPct - previousCrossing) > AGREEMENT_TOLERANCE
    ) {
      return false;
    }
    this.confirmed[boundary] = (previousCrossing + lapPct) / 2;
    return this.publishConfirmed();
  }

  boundaries(): readonly number[] | null {
    return this.published;
  }

  private publishConfirmed(): boolean {
    const s2 = this.confirmed[0];
    const s3 = this.confirmed[1];
    if (s2 === null || s3 === null || s3 - s2 < MIN_SECTOR_GAP) return false;
    const published = this.published;
    if (
      published !== null &&
      Math.abs(published[0] - s2) <= AGREEMENT_TOLERANCE &&
      Math.abs(published[1] - s3) <= AGREEMENT_TOLERANCE
    ) {
      return false;
    }
    this.published = [s2, s3];
    this.learnedByTrack.set(this.trackName, this.published);
    return true;
  }
}
