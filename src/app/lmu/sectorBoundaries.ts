const PIT_LANE_BIT = 0x80000000;
const SECTOR_MASK = 0x7fffffff;
const MIN_BOUNDARY = 0.02;
const MAX_BOUNDARY = 0.98;
const MIN_SECTOR_GAP = 0.02;
const MAX_FRAME_STEP = 0.01;
const MIN_STEADY_FRAMES = 10;
const SAME_LINE = 0.001;

export type LmuSectorBoundaries = readonly [number, number];

export interface LmuSectorBoundarySources {
  known(trackKey: string): LmuSectorBoundaries | null;
  measured(trackKey: string, boundaries: LmuSectorBoundaries): void;
}

export const isPlausibleLmuSectorBoundaries = (
  s2: number,
  s3: number
): boolean =>
  Number.isFinite(s2) &&
  Number.isFinite(s3) &&
  s2 > MIN_BOUNDARY &&
  s3 < MAX_BOUNDARY &&
  s3 - s2 >= MIN_SECTOR_GAP;

export const sameLmuSectorBoundaries = (
  a: LmuSectorBoundaries,
  b: LmuSectorBoundaries
): boolean =>
  Math.abs(a[0] - b[0]) < SAME_LINE && Math.abs(a[1] - b[1]) < SAME_LINE;

interface PublishedBoundaries {
  boundaries: LmuSectorBoundaries;
  confirmed: boolean;
}

export class LmuSectorBoundaryLearner {
  private readonly learnedByTrack = new Map<string, PublishedBoundaries>();
  private trackKey = '';
  private published: PublishedBoundaries | null = null;
  private candidate: LmuSectorBoundaries | null = null;
  private settled = false;
  private pendingS2: number | null = null;
  private pendingS3: number | null = null;
  private lastSector: number | null = null;
  private lastPct: number | null = null;
  private steadyFrames = 0;

  constructor(private readonly sources?: LmuSectorBoundarySources) {}

  reset(trackKey: string): void {
    this.trackKey = trackKey;
    const learned = this.learnedByTrack.get(trackKey);
    const known = learned ? null : (this.sources?.known(trackKey) ?? null);
    this.published =
      learned ?? (known ? { boundaries: known, confirmed: true } : null);
    this.candidate = null;
    this.settled = false;
    this.pendingS2 = null;
    this.pendingS3 = null;
    this.lastSector = null;
    this.lastPct = null;
    this.steadyFrames = 0;
  }

  update(rawSector: number | undefined, lapPct: number | undefined): boolean {
    if (this.settled) return false;
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
    this.pendingS2 = null;
    this.pendingS3 = null;
    return this.take(measurement);
  }

  boundaries(): LmuSectorBoundaries | null {
    return this.published?.boundaries ?? null;
  }

  private take(measurement: LmuSectorBoundaries): boolean {
    if (this.published === null) {
      this.publish({ boundaries: measurement, confirmed: false });
      return true;
    }
    const { boundaries, confirmed } = this.published;
    if (sameLmuSectorBoundaries(measurement, boundaries)) {
      this.settle(boundaries);
      if (!confirmed) this.sources?.measured(this.trackKey, boundaries);
      return false;
    }
    const candidate = this.candidate;
    if (candidate !== null && sameLmuSectorBoundaries(measurement, candidate)) {
      this.settle(candidate);
      this.sources?.measured(this.trackKey, candidate);
      return true;
    }
    this.candidate = measurement;
    return false;
  }

  private settle(boundaries: LmuSectorBoundaries): void {
    this.publish({ boundaries, confirmed: true });
    this.candidate = null;
    this.settled = true;
  }

  private publish(published: PublishedBoundaries): void {
    this.published = published;
    this.learnedByTrack.set(this.trackKey, published);
  }
}
