import type { LmuTrackMap } from '@irdashies/types';
import {
  MAP_REGISTRATION_SAMPLE_INTERVAL_S,
  type MapRegistrationFit,
} from './mapRegistration';

export const TRACK_WIDTH_BIN_M = 2;
export const ROAD_EDGES_REACH_M = 180;
export const OFF_TRACK_MARGIN_M = 1;
export const ROAD_EDGES_HEADER = 3;
export const TRACK_WIDTH_STORE_VERSION = 2;
export const TRACK_WIDTH_BUNDLE_BIN_M = 4;
export const BUNDLE_CHECK_SAMPLES = 200;
export const BUNDLE_CHECK_MAX_MEDIAN_M = 1.5;
const BUNDLE_CHECK_STRETCHES = 20;
const BUNDLE_CHECK_STRETCH_SAMPLES =
  BUNDLE_CHECK_SAMPLES / BUNDLE_CHECK_STRETCHES;
const BUNDLE_CHECK_STRETCH_MIN_SAMPLES = 3;
const BUNDLE_CHECK_COVERED_STRETCHES = 16;

interface ReferenceVerdict {
  agrees: boolean;
  samples: number;
  medianM: number;
}

interface ReferenceSide {
  diffs: Float64Array;
  counts: Int32Array;
}

const createReferenceSide = (): ReferenceSide => ({
  diffs: new Float64Array(BUNDLE_CHECK_SAMPLES),
  counts: new Int32Array(BUNDLE_CHECK_STRETCHES),
});

const medianOfSide = (side: ReferenceSide): number => {
  const values: number[] = [];
  for (let stretch = 0; stretch < BUNDLE_CHECK_STRETCHES; stretch += 1) {
    const start = stretch * BUNDLE_CHECK_STRETCH_SAMPLES;
    for (let index = 0; index < side.counts[stretch]; index += 1) {
      values.push(side.diffs[start + index]);
    }
  }
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};

const medianOf = (values: Float64Array, count: number): number => {
  const sorted = values.slice(0, count).sort();
  return sorted[Math.floor(count / 2)];
};

const MIN_SIDE_LATERAL_M = 0.5;
const MIN_HALF_WIDTH_M = 3;
const MAX_HALF_WIDTH_M = 25;
const MAX_LATERAL_M = 60;
const MAX_LINE_OFFSET_M = 30;
const MIN_SAMPLE_SPEED_MS = 5;
const PROJECTION_SEARCH_M = 20;
const SIGN_EVALUATE_EVERY_SAMPLES = 50;
const SIGN_MIN_DEGREES = 300;
const SIGN_REFUSE_DEGREES = 3000;
const SIGN_MIN_CORRELATION = 0.5;
const SIGN_MIN_SLOPE = 0.6;
const SIGN_MAX_SLOPE = 1.4;
const CENTRE_SMOOTHING_M = 16;
const WIDTH_SMOOTHING_M = 24;
const GLOBAL_INTERVAL_S = 10;
const MIN_SUPPORT = 2;
const MIRROR_WEIGHT = 5;
const OUTLIER_MIN_SUPPORT = 10;
const OUTLIER_CENTRE_M = 2;
const OUTLIER_WIDTH_M = 1.5;
const ASYMMETRY_BUCKET_M = 0.1;
const ASYMMETRY_RANGE_M = 20;
const GAP_FILL_M = 50;
const SEED_WEIGHT = 20;
const SEED_RESIDUE = 1e-6;
const MAX_STORED_COUNT = 255;
const MAX_CARS = 128;
const SAVE_MIN_INTERVAL_S = 60;
const SAVE_MIN_COVERAGE_GAIN = 0.02;
const MAX_INTERPOLATION_M = 20;
const MAX_INTERPOLATION_GAP_S = 0.5;
const INTERPOLATED_WEIGHT = 0.5;

type Sign = 1 | -1;

const wrap01 = (value: number): number => ((value % 1) + 1) % 1;

const finite = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value);

export class LmuDrawnLine {
  readonly count: number;
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  private readonly searchSegments: number;

  constructor(
    points: readonly { x: number; y: number }[],
    fit: MapRegistrationFit
  ) {
    const { ar, ai, tx, ty, mirrored } = fit;
    this.count = points.length;
    this.xs = new Float64Array(this.count);
    this.ys = new Float64Array(this.count);
    for (let index = 0; index < this.count; index += 1) {
      const mx = points[index].x;
      const my = mirrored ? -points[index].y : points[index].y;
      this.xs[index] = ar * mx - ai * my + tx;
      this.ys[index] = ai * mx + ar * my + ty;
    }
    let length = 0;
    for (let index = 0; index < this.count; index += 1) {
      const next = (index + 1) % this.count;
      length += Math.hypot(
        this.xs[next] - this.xs[index],
        this.ys[next] - this.ys[index]
      );
    }
    const segment = this.count > 0 ? length / this.count : 0;
    this.searchSegments =
      segment > 0
        ? Math.min(
            Math.floor(this.count / 2),
            Math.max(1, Math.ceil(PROJECTION_SEARCH_M / segment))
          )
        : 0;
  }

  signedOffset(pct: number, x: number, y: number): number {
    const { count, xs, ys } = this;
    if (count < 2) return Number.NaN;
    const around = Math.floor(wrap01(pct) * count) % count;
    let best = Number.POSITIVE_INFINITY;
    let side = 0;
    let bestStep = 0;
    let bestAmount = 0;
    for (
      let step = -this.searchSegments;
      step <= this.searchSegments;
      step += 1
    ) {
      const index = (((around + step) % count) + count) % count;
      const next = (index + 1) % count;
      const dx = xs[next] - xs[index];
      const dy = ys[next] - ys[index];
      const lengthSq = dx * dx + dy * dy;
      if (!(lengthSq > 0)) continue;
      let amount = ((x - xs[index]) * dx + (y - ys[index]) * dy) / lengthSq;
      if (amount < 0) amount = 0;
      else if (amount > 1) amount = 1;
      const px = x - (xs[index] + dx * amount);
      const py = y - (ys[index] + dy * amount);
      const distanceSq = px * px + py * py;
      if (distanceSq < best) {
        best = distanceSq;
        side = px * dy - py * dx;
        bestStep = step;
        bestAmount = amount;
      }
    }
    if (!Number.isFinite(best)) return Number.NaN;
    if (
      (bestStep === -this.searchSegments && bestAmount === 0) ||
      (bestStep === this.searchSegments && bestAmount === 1)
    ) {
      return Number.NaN;
    }
    return side < 0 ? -Math.sqrt(best) : Math.sqrt(best);
  }

  pointAt(
    pct: number,
    offset: number,
    out: { x: number; y: number }
  ): { x: number; y: number } {
    const { count, xs, ys } = this;
    out.x = Number.NaN;
    out.y = Number.NaN;
    if (count < 2) return out;
    const floatIndex = wrap01(pct) * count;
    const index = Math.floor(floatIndex) % count;
    const next = (index + 1) % count;
    const amount = floatIndex - Math.floor(floatIndex);
    const dx = xs[next] - xs[index];
    const dy = ys[next] - ys[index];
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) return out;
    out.x = xs[index] + dx * amount + (offset * dy) / length;
    out.y = ys[index] + dy * amount - (offset * dx) / length;
    return out;
  }
}

export interface TrackWidthSampleInput {
  time: number;
  scoringTime: number;
  lapDistM: number;
  posX: ArrayLike<number>;
  posZ: ArrayLike<number>;
  scoringPosX?: ArrayLike<number>;
  scoringPosZ?: ArrayLike<number>;
  playerIdx?: number;
  available: ArrayLike<number>;
  pcts: readonly unknown[];
  scoringPcts?: ArrayLike<number>;
  inPits?: ArrayLike<number>;
  speeds?: ArrayLike<number>;
  pathLateral?: ArrayLike<number>;
  trackEdge?: ArrayLike<number>;
  valid?: ArrayLike<number>;
}

export type TrackWidthStatus = 'collecting' | 'ready' | 'refused';

export interface TrackWidthSignCheck {
  sign: Sign | null;
  slope: number;
  correlation: number;
  residualM: number;
  samples: number;
}

export interface TrackWidthDiagnostics {
  playerLeft: number;
  playerRight: number;
  othersLeft: number;
  othersRight: number;
  rejected: number;
  interpolated: number;
  otherDriversSeen: number;
  otherDriversWithEdge: number;
}

export interface StoredTrackWidth {
  version: number;
  bins: number;
  lapDistM: number;
  sign: Sign;
  centre: number[];
  left: number[];
  right: number[];
  centreCount: number[];
  leftCount: number[];
  rightCount: number[];
}

const intArray = (
  value: unknown,
  length: number,
  minimum = Number.NEGATIVE_INFINITY
): number[] | null => {
  if (!Array.isArray(value) || value.length !== length) return null;
  for (const entry of value) {
    if (
      typeof entry !== 'number' ||
      !Number.isFinite(entry) ||
      entry < minimum
    ) {
      return null;
    }
  }
  return value as number[];
};

export function parseStoredTrackWidth(value: unknown): StoredTrackWidth | null {
  if (value === null || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  const { version, bins, lapDistM, sign } = entry;
  if (version !== TRACK_WIDTH_STORE_VERSION) return null;
  if (typeof bins !== 'number' || !Number.isInteger(bins) || bins < 2) {
    return null;
  }
  if (typeof lapDistM !== 'number' || !(lapDistM > 0)) return null;
  if (sign !== 1 && sign !== -1) return null;
  const centre = intArray(entry.centre, bins);
  const left = intArray(entry.left, bins);
  const right = intArray(entry.right, bins);
  const centreCount = intArray(entry.centreCount, bins, 0);
  const leftCount = intArray(entry.leftCount, bins, 0);
  const rightCount = intArray(entry.rightCount, bins, 0);
  if (!centre || !left || !right || !centreCount || !leftCount || !rightCount) {
    return null;
  }
  return {
    version,
    bins,
    lapDistM,
    sign,
    centre,
    left,
    right,
    centreCount,
    leftCount,
    rightCount,
  };
}

export interface BundledTrackWidth {
  bins: number;
  sign: Sign;
  centre: number[];
  left: number[];
  right: number[];
  centreCount: number[];
  leftCount: number[];
  rightCount: number[];
}

export interface TrackWidthBundleEntry {
  width: BundledTrackWidth;
  samples: number;
  smoothedCoverage: number;
  irdashiesVersion: string;
}

export interface TrackWidthBundle {
  trackWidth: (
    trackName: string,
    lapDistM: number
  ) => TrackWidthBundleEntry | null;
}

export const bundleBinsFor = (lapDistM: number): number =>
  Math.max(2, Math.round(lapDistM / TRACK_WIDTH_BUNDLE_BIN_M));

const bundleBinOf = (bin: number, bins: number, bundleBins: number): number =>
  Math.min(bundleBins - 1, Math.floor(((bin + 0.5) / bins) * bundleBins));

export function bundledTrackWidthFromStored(
  stored: StoredTrackWidth,
  line: LmuDrawnLine,
  bundleBins: number
): BundledTrackWidth {
  const centreWeight = new Float64Array(bundleBins);
  const centreSum = new Float64Array(bundleBins);
  const leftWeight = new Float64Array(bundleBins);
  const leftSum = new Float64Array(bundleBins);
  const rightWeight = new Float64Array(bundleBins);
  const rightSum = new Float64Array(bundleBins);
  for (let bin = 0; bin < stored.bins; bin += 1) {
    const target = bundleBinOf(bin, stored.bins, bundleBins);
    const centreN = stored.centreCount[bin];
    if (centreN > 0) {
      centreWeight[target] += centreN;
      centreSum[target] += (stored.centre[bin] / 10) * centreN;
    }
    const leftN = stored.leftCount[bin];
    if (leftN > 0) {
      leftWeight[target] += leftN;
      leftSum[target] += stored.left[bin] * leftN;
    }
    const rightN = stored.rightCount[bin];
    if (rightN > 0) {
      rightWeight[target] += rightN;
      rightSum[target] += stored.right[bin] * rightN;
    }
  }
  const width: BundledTrackWidth = {
    bins: bundleBins,
    sign: stored.sign,
    centre: new Array<number>(bundleBins * 2).fill(0),
    left: new Array<number>(bundleBins).fill(0),
    right: new Array<number>(bundleBins).fill(0),
    centreCount: new Array<number>(bundleBins).fill(0),
    leftCount: new Array<number>(bundleBins).fill(0),
    rightCount: new Array<number>(bundleBins).fill(0),
  };
  const point = { x: 0, y: 0 };
  for (let bin = 0; bin < bundleBins; bin += 1) {
    if (centreWeight[bin] > 0) {
      line.pointAt(
        (bin + 0.5) / bundleBins,
        centreSum[bin] / centreWeight[bin],
        point
      );
      if (finite(point.x) && finite(point.y)) {
        width.centre[bin * 2] = Math.round(point.x * 10);
        width.centre[bin * 2 + 1] = Math.round(point.y * 10);
        width.centreCount[bin] = Math.min(
          Math.round(centreWeight[bin]),
          MAX_STORED_COUNT
        );
      }
    }
    if (leftWeight[bin] > 0) {
      width.left[bin] = Math.round(leftSum[bin] / leftWeight[bin]);
      width.leftCount[bin] = Math.min(
        Math.round(leftWeight[bin]),
        MAX_STORED_COUNT
      );
    }
    if (rightWeight[bin] > 0) {
      width.right[bin] = Math.round(rightSum[bin] / rightWeight[bin]);
      width.rightCount[bin] = Math.min(
        Math.round(rightWeight[bin]),
        MAX_STORED_COUNT
      );
    }
  }
  return width;
}

export function storedTrackWidthFromBundle(
  width: BundledTrackWidth,
  line: LmuDrawnLine,
  lapDistM: number
): StoredTrackWidth | null {
  if (!(lapDistM > 0) || width.bins < 2) return null;
  const bins = Math.max(2, Math.round(lapDistM / TRACK_WIDTH_BIN_M));
  const offsets = new Float64Array(width.bins).fill(Number.NaN);
  for (let bin = 0; bin < width.bins; bin += 1) {
    if (!(width.centreCount[bin] > 0)) continue;
    offsets[bin] = line.signedOffset(
      (bin + 0.5) / width.bins,
      width.centre[bin * 2] / 10,
      width.centre[bin * 2 + 1] / 10
    );
  }
  const share = width.bins / bins;
  const stored: StoredTrackWidth = {
    version: TRACK_WIDTH_STORE_VERSION,
    bins,
    lapDistM,
    sign: width.sign,
    centre: new Array<number>(bins).fill(0),
    left: new Array<number>(bins).fill(0),
    right: new Array<number>(bins).fill(0),
    centreCount: new Array<number>(bins).fill(0),
    leftCount: new Array<number>(bins).fill(0),
    rightCount: new Array<number>(bins).fill(0),
  };
  let known = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    const source = bundleBinOf(bin, bins, width.bins);
    const offset = offsets[source];
    if (finite(offset) && Math.abs(offset) <= MAX_LINE_OFFSET_M) {
      stored.centre[bin] = offset * 10;
      stored.centreCount[bin] = width.centreCount[source] * share;
      known += 1;
    }
    if (width.leftCount[source] > 0) {
      stored.left[bin] = width.left[source];
      stored.leftCount[bin] = width.leftCount[source] * share;
    }
    if (width.rightCount[source] > 0) {
      stored.right[bin] = width.right[source];
      stored.rightCount[bin] = width.rightCount[source] * share;
    }
  }
  return known > 0 ? stored : null;
}

const triangleWeights = (smoothingM: number, binM: number, bins: number) => {
  const radius = Math.min(
    Math.max(0, Math.floor((bins - 1) / 2)),
    Math.max(1, Math.round(smoothingM / binM))
  );
  const weights = new Float64Array(radius * 2 + 1);
  for (let step = -radius; step <= radius; step += 1) {
    weights[step + radius] = 1 - Math.abs(step) / (radius + 1);
  }
  return weights;
};

export class LmuTrackWidthProfile {
  private line: LmuDrawnLine | null = null;
  private bins = 0;
  private lapDistM = 0;
  private centreWeights = new Float64Array(1);
  private widthWeights = new Float64Array(1);
  private count = new Float64Array(0);
  private sumOffset = new Float64Array(0);
  private sumLateral = new Float64Array(0);
  private sumSqOffset = new Float64Array(0);
  private sumSqLateral = new Float64Array(0);
  private sumCross = new Float64Array(0);
  private positiveCount = new Float64Array(0);
  private positiveSum = new Float64Array(0);
  private negativeCount = new Float64Array(0);
  private negativeSum = new Float64Array(0);
  private smoothCount = new Float64Array(0);
  private smoothOffset = new Float64Array(0);
  private smoothLateral = new Float64Array(0);
  private smoothPositiveCount = new Float64Array(0);
  private smoothPositiveSum = new Float64Array(0);
  private smoothNegativeCount = new Float64Array(0);
  private smoothNegativeSum = new Float64Array(0);
  private edgeLeft = new Float64Array(0);
  private edgeRight = new Float64Array(0);
  private edgeDirty = new Uint8Array(0);
  private resolvedLeft = new Float64Array(0);
  private resolvedRight = new Float64Array(0);
  private readonly window: number[] = [];
  private readonly carsSeen = new Uint8Array(MAX_CARS);
  private readonly carsWithEdge = new Uint8Array(MAX_CARS);
  private readonly previousSide = new Int8Array(MAX_CARS);
  private readonly previousPct = new Float64Array(MAX_CARS);
  private readonly previousHalfWidth = new Float64Array(MAX_CARS);
  private readonly previousScoringTime = new Float64Array(MAX_CARS);
  private interpolated = 0;
  private readonly asymmetryBuckets = new Uint32Array(
    Math.round((ASYMMETRY_RANGE_M * 2) / ASYMMETRY_BUCKET_M) + 1
  );
  private asymmetry = 0;
  private supported = 0;
  private dirty = false;
  private lastGlobalTime = Number.NEGATIVE_INFINITY;
  private edgeVersion = 0;
  private playerPositive = 0;
  private playerNegative = 0;
  private othersPositive = 0;
  private othersNegative = 0;
  private rejected = 0;
  private windowVersion = -1;
  private windowBin = -1;
  private signValue: Sign | null = null;
  private refused = false;
  private taken = 0;
  private sinceEvaluation = 0;
  private lastSampleTime = Number.NEGATIVE_INFINITY;
  private lastScoringTime = Number.NaN;
  private lastCheck: TrackWidthSignCheck | null = null;
  private referenceLeft: Float64Array | null = null;
  private referenceRight: Float64Array | null = null;
  private readonly referenceSides = [
    createReferenceSide(),
    createReferenceSide(),
  ];

  get sign(): Sign | null {
    return this.signValue;
  }

  get status(): TrackWidthStatus {
    if (this.refused) return 'refused';
    return this.signValue === null ? 'collecting' : 'ready';
  }

  get samples(): number {
    return this.taken;
  }

  get binCount(): number {
    return this.bins;
  }

  get signCheck(): TrackWidthSignCheck | null {
    return this.lastCheck;
  }

  reset(line: LmuDrawnLine | null, lapDistM: number): void {
    this.line = line && lapDistM > 0 ? line : null;
    this.lapDistM = this.line ? lapDistM : 0;
    const bins = this.line
      ? Math.max(2, Math.round(lapDistM / TRACK_WIDTH_BIN_M))
      : 0;
    if (bins !== this.bins) {
      this.bins = bins;
      this.count = new Float64Array(bins);
      this.sumOffset = new Float64Array(bins);
      this.sumLateral = new Float64Array(bins);
      this.sumSqOffset = new Float64Array(bins);
      this.sumSqLateral = new Float64Array(bins);
      this.sumCross = new Float64Array(bins);
      this.positiveCount = new Float64Array(bins);
      this.positiveSum = new Float64Array(bins);
      this.negativeCount = new Float64Array(bins);
      this.negativeSum = new Float64Array(bins);
      this.smoothCount = new Float64Array(bins);
      this.smoothOffset = new Float64Array(bins);
      this.smoothLateral = new Float64Array(bins);
      this.smoothPositiveCount = new Float64Array(bins);
      this.smoothPositiveSum = new Float64Array(bins);
      this.smoothNegativeCount = new Float64Array(bins);
      this.smoothNegativeSum = new Float64Array(bins);
      this.edgeLeft = new Float64Array(bins);
      this.edgeRight = new Float64Array(bins);
      this.edgeDirty = new Uint8Array(bins);
    } else {
      this.count.fill(0);
      this.sumOffset.fill(0);
      this.sumLateral.fill(0);
      this.sumSqOffset.fill(0);
      this.sumSqLateral.fill(0);
      this.sumCross.fill(0);
      this.positiveCount.fill(0);
      this.positiveSum.fill(0);
      this.negativeCount.fill(0);
      this.negativeSum.fill(0);
      this.smoothCount.fill(0);
      this.smoothOffset.fill(0);
      this.smoothLateral.fill(0);
      this.smoothPositiveCount.fill(0);
      this.smoothPositiveSum.fill(0);
      this.smoothNegativeCount.fill(0);
      this.smoothNegativeSum.fill(0);
    }
    this.edgeLeft.fill(Number.NaN);
    this.edgeRight.fill(Number.NaN);
    this.edgeDirty.fill(1);
    const binM = bins > 0 ? this.lapDistM / bins : TRACK_WIDTH_BIN_M;
    this.centreWeights = triangleWeights(CENTRE_SMOOTHING_M, binM, bins);
    this.widthWeights = triangleWeights(WIDTH_SMOOTHING_M, binM, bins);
    this.carsSeen.fill(0);
    this.carsWithEdge.fill(0);
    this.previousSide.fill(0);
    this.interpolated = 0;
    this.asymmetry = 0;
    this.supported = 0;
    this.dirty = false;
    this.lastGlobalTime = Number.NEGATIVE_INFINITY;
    this.edgeVersion += 1;
    this.playerPositive = 0;
    this.playerNegative = 0;
    this.othersPositive = 0;
    this.othersNegative = 0;
    this.rejected = 0;
    this.signValue = null;
    this.refused = false;
    this.taken = 0;
    this.sinceEvaluation = 0;
    this.lastSampleTime = Number.NEGATIVE_INFINITY;
    this.lastScoringTime = Number.NaN;
    this.lastCheck = null;
    this.referenceLeft = null;
    this.referenceRight = null;
    this.clearReferenceSamples();
  }

  private clearReferenceSamples(): void {
    for (const side of this.referenceSides) side.counts.fill(0);
  }

  setReference(stored: StoredTrackWidth | null): void {
    this.clearReferenceSamples();
    if (!stored || stored.bins !== this.bins) {
      this.referenceLeft = null;
      this.referenceRight = null;
      return;
    }
    const left = new Float64Array(this.bins).fill(Number.NaN);
    const right = new Float64Array(this.bins).fill(Number.NaN);
    for (let bin = 0; bin < this.bins; bin += 1) {
      if (!(stored.centreCount[bin] > 0)) continue;
      const centre = stored.centre[bin] / 10;
      if (stored.leftCount[bin] > 0) left[bin] = centre + stored.left[bin] / 10;
      if (stored.rightCount[bin] > 0) {
        right[bin] = centre - stored.right[bin] / 10;
      }
    }
    this.referenceLeft = left;
    this.referenceRight = right;
  }

  referenceCheck(): ReferenceVerdict | null {
    if (!this.referenceLeft) return null;
    let worst = 0;
    let samples = 0;
    let covered = true;
    for (const side of this.referenceSides) {
      let coveredStretches = 0;
      for (let stretch = 0; stretch < BUNDLE_CHECK_STRETCHES; stretch += 1) {
        const count = side.counts[stretch];
        samples += count;
        if (count >= BUNDLE_CHECK_STRETCH_MIN_SAMPLES) coveredStretches += 1;
        if (count < BUNDLE_CHECK_STRETCH_SAMPLES) continue;
        const medianM = medianOf(
          side.diffs.subarray(
            stretch * BUNDLE_CHECK_STRETCH_SAMPLES,
            (stretch + 1) * BUNDLE_CHECK_STRETCH_SAMPLES
          ),
          count
        );
        if (medianM > BUNDLE_CHECK_MAX_MEDIAN_M) {
          return { agrees: false, samples: count, medianM };
        }
      }
      if (coveredStretches < BUNDLE_CHECK_COVERED_STRETCHES) covered = false;
      worst = Math.max(worst, medianOfSide(side));
    }
    if (!covered) return null;
    if (worst > BUNDLE_CHECK_MAX_MEDIAN_M) {
      return { agrees: false, samples, medianM: worst };
    }
    return { agrees: true, samples, medianM: worst };
  }

  private recordReference(
    bin: number,
    sign: Sign,
    offset: number,
    lateral: number,
    halfWidth: number
  ): void {
    const left = this.referenceLeft;
    const right = this.referenceRight;
    if (!left || !right) return;
    const isLeft = sign > 0 ? lateral > 0 : lateral < 0;
    const side = this.referenceSides[isLeft ? 0 : 1];
    const stretch = Math.min(
      BUNDLE_CHECK_STRETCHES - 1,
      Math.floor((bin * BUNDLE_CHECK_STRETCHES) / this.bins)
    );
    const count = side.counts[stretch];
    if (count >= BUNDLE_CHECK_STRETCH_SAMPLES) return;
    const reference = isLeft ? left[bin] : right[bin];
    if (!finite(reference)) return;
    const centre = offset - sign * lateral;
    const edge = isLeft ? centre + halfWidth : centre - halfWidth;
    side.diffs[stretch * BUNDLE_CHECK_STRETCH_SAMPLES + count] = Math.abs(
      edge - reference
    );
    side.counts[stretch] = count + 1;
  }

  update(input: TrackWidthSampleInput): boolean {
    const { line, bins } = this;
    const { pathLateral, trackEdge } = input;
    if (!line || this.refused || !pathLateral || !trackEdge) return false;
    if (input.time < this.lastSampleTime) {
      this.lastSampleTime = Number.NEGATIVE_INFINITY;
      this.lastGlobalTime = Number.NEGATIVE_INFINITY;
    }
    if (input.time - this.lastSampleTime < MAP_REGISTRATION_SAMPLE_INTERVAL_S) {
      return false;
    }
    if (Object.is(input.scoringTime, this.lastScoringTime)) return false;
    this.lastSampleTime = input.time;
    this.lastScoringTime = input.scoringTime;

    const { scoringPcts, scoringPosX, scoringPosZ } = input;
    const playerIdx = input.playerIdx ?? -1;
    const cars = Math.min(
      input.available.length,
      scoringPcts ? scoringPcts.length : input.pcts.length,
      pathLateral.length,
      trackEdge.length,
      MAX_CARS
    );
    const sign = this.signValue;
    let added = 0;
    for (let carIdx = 0; carIdx < cars; carIdx += 1) {
      const previousSide = this.previousSide[carIdx];
      this.previousSide[carIdx] = 0;
      if (input.available[carIdx] !== 1) continue;
      if (input.valid !== undefined && input.valid[carIdx] !== 1) continue;
      if (input.inPits?.[carIdx] === 1) continue;
      if (
        input.speeds !== undefined &&
        !(input.speeds[carIdx] >= MIN_SAMPLE_SPEED_MS)
      ) {
        continue;
      }
      const pct = scoringPcts ? scoringPcts[carIdx] : input.pcts[carIdx];
      if (typeof pct !== 'number' || !(pct > 0) || !(pct < 1)) continue;
      const isPlayer = carIdx === playerIdx;
      if (!isPlayer) this.carsSeen[carIdx] = 1;
      const lateral = pathLateral[carIdx];
      const edge = trackEdge[carIdx];
      if (!finite(lateral) || !finite(edge)) continue;
      const halfWidth = Math.abs(edge);
      if (halfWidth < MIN_HALF_WIDTH_M || halfWidth > MAX_HALF_WIDTH_M) {
        continue;
      }
      if (!isPlayer) this.carsWithEdge[carIdx] = 1;
      if (Math.abs(lateral) > MAX_LATERAL_M) continue;
      if (Math.abs(lateral) - halfWidth > OFF_TRACK_MARGIN_M) continue;
      const scoringX = scoringPosX?.[carIdx];
      const scoringZ = scoringPosZ?.[carIdx];
      const useScoring = finite(scoringX) && finite(scoringZ);
      const x = useScoring ? scoringX : input.posX[carIdx];
      const z = useScoring ? scoringZ : input.posZ[carIdx];
      const offset = line.signedOffset(pct, x, -z);
      if (!finite(offset) || Math.abs(offset) > MAX_LINE_OFFSET_M) continue;

      const bin = Math.min(bins - 1, Math.floor(pct * bins));
      const sided = Math.abs(lateral) >= MIN_SIDE_LATERAL_M;
      if (sign !== null && sided && this.referenceLeft) {
        this.recordReference(bin, sign, offset, lateral, halfWidth);
      }
      if (
        sign !== null &&
        this.isOutlier(bin, sign, offset, lateral, sided ? halfWidth : null)
      ) {
        this.rejected += 1;
        continue;
      }
      this.count[bin] += 1;
      this.sumOffset[bin] += offset;
      this.sumLateral[bin] += lateral;
      this.sumSqOffset[bin] += offset * offset;
      this.sumSqLateral[bin] += lateral * lateral;
      this.sumCross[bin] += offset * lateral;
      this.spreadCentre(bin, 1, offset, lateral);
      if (sided) this.spreadSide(bin, lateral > 0, 1, halfWidth);
      if (sided) {
        if (lateral > 0) {
          this.positiveCount[bin] += 1;
          this.positiveSum[bin] += halfWidth;
          if (isPlayer) this.playerPositive += 1;
          else this.othersPositive += 1;
        } else {
          this.negativeCount[bin] += 1;
          this.negativeSum[bin] += halfWidth;
          if (isPlayer) this.playerNegative += 1;
          else this.othersNegative += 1;
        }
        const side = lateral > 0 ? 1 : -1;
        if (previousSide === side) {
          this.interpolateSide(
            carIdx,
            pct,
            side > 0,
            halfWidth,
            input.scoringTime
          );
        }
        this.previousSide[carIdx] = side;
        this.previousPct[carIdx] = pct;
        this.previousHalfWidth[carIdx] = halfWidth;
        this.previousScoringTime[carIdx] = input.scoringTime;
      }
      added += 1;
    }
    this.taken += added;
    this.sinceEvaluation += added;
    if (added > 0) {
      this.dirty = true;
      this.edgeVersion += 1;
    }
    if (
      this.signValue === null &&
      this.sinceEvaluation >= SIGN_EVALUATE_EVERY_SAMPLES
    ) {
      this.sinceEvaluation = 0;
      this.evaluateSign();
      if (this.signValue !== null) this.global(input.time);
    }
    if (
      this.signValue !== null &&
      this.dirty &&
      input.time - this.lastGlobalTime >= GLOBAL_INTERVAL_S
    ) {
      this.global(input.time);
    }
    return added > 0;
  }

  private interpolateSide(
    carIdx: number,
    pct: number,
    positive: boolean,
    halfWidth: number,
    scoringTime: number
  ): void {
    const { bins } = this;
    const gap = scoringTime - this.previousScoringTime[carIdx];
    if (!(gap > 0) || gap > MAX_INTERPOLATION_GAP_S) return;
    const previousPct = this.previousPct[carIdx];
    const ahead = wrap01(pct - previousPct) * this.lapDistM;
    if (!(ahead > 0) || ahead > MAX_INTERPOLATION_M) return;
    const fromBin = Math.min(bins - 1, Math.floor(previousPct * bins));
    const toBin = Math.min(bins - 1, Math.floor(pct * bins));
    const steps = (toBin - fromBin + bins) % bins;
    if (steps < 2) return;
    const fromWidth = this.previousHalfWidth[carIdx];
    const counts = positive ? this.positiveCount : this.negativeCount;
    const sums = positive ? this.positiveSum : this.negativeSum;
    for (let step = 1; step < steps; step += 1) {
      const bin = (fromBin + step) % bins;
      const width = fromWidth + ((halfWidth - fromWidth) * step) / steps;
      counts[bin] += INTERPOLATED_WEIGHT;
      sums[bin] += INTERPOLATED_WEIGHT * width;
      this.spreadSide(bin, positive, INTERPOLATED_WEIGHT, width);
      this.interpolated += 1;
    }
  }

  private isOutlier(
    bin: number,
    sign: Sign,
    offset: number,
    lateral: number,
    halfWidth: number | null
  ): boolean {
    const support = this.smoothCount[bin];
    if (
      support >= OUTLIER_MIN_SUPPORT &&
      Math.abs(
        offset -
          sign * lateral -
          (this.smoothOffset[bin] - sign * this.smoothLateral[bin]) / support
      ) > OUTLIER_CENTRE_M
    ) {
      return true;
    }
    if (halfWidth === null) return false;
    const positive = lateral > 0;
    const sideSupport = positive
      ? this.smoothPositiveCount[bin]
      : this.smoothNegativeCount[bin];
    const sideSum = positive
      ? this.smoothPositiveSum[bin]
      : this.smoothNegativeSum[bin];
    return (
      sideSupport >= OUTLIER_MIN_SUPPORT &&
      Math.abs(halfWidth - sideSum / sideSupport) > OUTLIER_WIDTH_M
    );
  }

  private evaluateSign(): void {
    let degrees = 0;
    let crossSum = 0;
    let lateralSum = 0;
    let offsetSum = 0;
    for (let bin = 0; bin < this.bins; bin += 1) {
      const n = this.count[bin];
      if (n < 2) continue;
      const offset = this.sumOffset[bin];
      const lateral = this.sumLateral[bin];
      crossSum += this.sumCross[bin] - (offset * lateral) / n;
      lateralSum += this.sumSqLateral[bin] - (lateral * lateral) / n;
      offsetSum += this.sumSqOffset[bin] - (offset * offset) / n;
      degrees += n - 1;
    }
    if (degrees < SIGN_MIN_DEGREES || !(lateralSum > 0) || !(offsetSum > 0)) {
      return;
    }
    const slope = crossSum / lateralSum;
    const correlation = crossSum / Math.sqrt(offsetSum * lateralSum);
    const residualM = Math.sqrt(
      Math.max(0, (offsetSum - slope * crossSum) / degrees)
    );
    const magnitude = Math.abs(slope);
    const sign: Sign | null =
      Math.abs(correlation) >= SIGN_MIN_CORRELATION &&
      magnitude >= SIGN_MIN_SLOPE &&
      magnitude <= SIGN_MAX_SLOPE
        ? slope > 0
          ? 1
          : -1
        : null;
    this.lastCheck = {
      sign,
      slope,
      correlation,
      residualM,
      samples: this.taken,
    };
    if (sign !== null) this.signValue = sign;
    else if (degrees >= SIGN_REFUSE_DEGREES) this.refused = true;
  }

  private spreadCentre(
    bin: number,
    weight: number,
    offset: number,
    lateral: number
  ): void {
    const { bins, centreWeights, edgeDirty } = this;
    const radius = (centreWeights.length - 1) / 2;
    let index = bin - radius;
    if (index < 0) index += bins;
    for (const kernel of centreWeights) {
      const share = kernel * weight;
      this.smoothCount[index] += share;
      this.smoothOffset[index] += share * offset;
      this.smoothLateral[index] += share * lateral;
      edgeDirty[index] = 1;
      index += 1;
      if (index >= bins) index = 0;
    }
  }

  private spreadSide(
    bin: number,
    positive: boolean,
    weight: number,
    halfWidth: number
  ): void {
    const { bins, widthWeights, edgeDirty } = this;
    const counts = positive
      ? this.smoothPositiveCount
      : this.smoothNegativeCount;
    const sums = positive ? this.smoothPositiveSum : this.smoothNegativeSum;
    const radius = (widthWeights.length - 1) / 2;
    let index = bin - radius;
    if (index < 0) index += bins;
    for (const kernel of widthWeights) {
      const share = kernel * weight;
      counts[index] += share;
      sums[index] += share * halfWidth;
      edgeDirty[index] = 1;
      index += 1;
      if (index >= bins) index = 0;
    }
  }

  private global(time: number): void {
    const sign = this.signValue;
    const { bins } = this;
    if (sign === null || !this.line || bins === 0) return;
    this.lastGlobalTime = time;
    this.dirty = false;
    const buckets = this.asymmetryBuckets;
    buckets.fill(0);
    const lastBucket = buckets.length - 1;
    let both = 0;
    let supported = 0;
    for (let bin = 0; bin < bins; bin += 1) {
      const positiveSupport = this.smoothPositiveCount[bin];
      const negativeSupport = this.smoothNegativeCount[bin];
      if (positiveSupport < MIN_SUPPORT || negativeSupport < MIN_SUPPORT) {
        continue;
      }
      both += 1;
      if (this.smoothCount[bin] >= MIN_SUPPORT) supported += 1;
      const difference =
        this.smoothNegativeSum[bin] / negativeSupport -
        this.smoothPositiveSum[bin] / positiveSupport;
      const bucket = Math.round(
        (difference + ASYMMETRY_RANGE_M) / ASYMMETRY_BUCKET_M
      );
      buckets[Math.min(lastBucket, Math.max(0, bucket))] += 1;
    }
    let asymmetry = 0;
    if (both > 0) {
      let seen = 0;
      let bucket = 0;
      for (; bucket < buckets.length; bucket += 1) {
        seen += buckets[bucket];
        if (seen * 2 >= both) break;
      }
      asymmetry = bucket * ASYMMETRY_BUCKET_M - ASYMMETRY_RANGE_M;
    }
    this.supported = supported / bins;
    if (asymmetry !== this.asymmetry) {
      this.asymmetry = asymmetry;
      this.edgeDirty.fill(1);
      this.edgeVersion += 1;
    }
  }

  private blendSide(
    measured: number,
    support: number,
    mirrored: number,
    otherSupport: number
  ): number {
    const mirrorWeight = Math.min(MIRROR_WEIGHT, otherSupport);
    if (!(support > 0)) return mirrored;
    if (!(mirrorWeight > 0)) return measured;
    return (
      (measured * support + mirrored * mirrorWeight) / (support + mirrorWeight)
    );
  }

  private resolveBin(bin: number, sign: Sign): void {
    this.edgeDirty[bin] = 0;
    this.edgeLeft[bin] = Number.NaN;
    this.edgeRight[bin] = Number.NaN;
    const support = this.smoothCount[bin];
    if (!(support >= MIN_SUPPORT)) return;
    const centre =
      (this.smoothOffset[bin] - sign * this.smoothLateral[bin]) / support;
    const positiveSupport = this.smoothPositiveCount[bin];
    const negativeSupport = this.smoothNegativeCount[bin];
    if (!finite(centre) || positiveSupport + negativeSupport < MIN_SUPPORT) {
      return;
    }
    const positiveMeasured =
      positiveSupport > 0
        ? this.smoothPositiveSum[bin] / positiveSupport
        : Number.NaN;
    const negativeMeasured =
      negativeSupport > 0
        ? this.smoothNegativeSum[bin] / negativeSupport
        : Number.NaN;
    let positive = this.blendSide(
      positiveMeasured,
      positiveSupport,
      negativeMeasured - this.asymmetry,
      negativeSupport
    );
    let negative = this.blendSide(
      negativeMeasured,
      negativeSupport,
      positiveMeasured + this.asymmetry,
      positiveSupport
    );
    positive = Math.min(MAX_HALF_WIDTH_M, Math.max(MIN_HALF_WIDTH_M, positive));
    negative = Math.min(MAX_HALF_WIDTH_M, Math.max(MIN_HALF_WIDTH_M, negative));
    const leftHalf = sign > 0 ? positive : negative;
    const rightHalf = sign > 0 ? negative : positive;
    this.edgeLeft[bin] = centre + leftHalf;
    this.edgeRight[bin] = centre - rightHalf;
  }

  coverage(): number {
    if (this.bins === 0) return 0;
    let both = 0;
    for (let bin = 0; bin < this.bins; bin += 1) {
      if (this.positiveCount[bin] > 0 && this.negativeCount[bin] > 0) {
        both += 1;
      }
    }
    return both / this.bins;
  }

  supportedCoverage(): number {
    if (this.signValue !== null && this.dirty) {
      this.global(this.lastGlobalTime);
    }
    return this.supported;
  }

  diagnostics(): TrackWidthDiagnostics {
    const leftIsPositive = this.signValue !== -1;
    let seen = 0;
    let withEdge = 0;
    for (let carIdx = 0; carIdx < MAX_CARS; carIdx += 1) {
      seen += this.carsSeen[carIdx];
      withEdge += this.carsWithEdge[carIdx];
    }
    return {
      playerLeft: leftIsPositive ? this.playerPositive : this.playerNegative,
      playerRight: leftIsPositive ? this.playerNegative : this.playerPositive,
      othersLeft: leftIsPositive ? this.othersPositive : this.othersNegative,
      othersRight: leftIsPositive ? this.othersNegative : this.othersPositive,
      rejected: this.rejected,
      interpolated: this.interpolated,
      otherDriversSeen: seen,
      otherDriversWithEdge: withEdge,
    };
  }

  seed(stored: StoredTrackWidth): boolean {
    if (!this.line || this.refused) return false;
    if (
      stored.bins !== this.bins ||
      Math.abs(stored.lapDistM - this.lapDistM) > TRACK_WIDTH_BIN_M
    ) {
      return false;
    }
    this.applySeed(stored, 1);
    this.signValue = stored.sign;
    this.edgeVersion += 1;
    this.global(this.lastGlobalTime);
    return true;
  }

  unseed(stored: StoredTrackWidth): void {
    if (!this.line || stored.bins !== this.bins) return;
    this.applySeed(stored, -1);
    const raw = [
      this.sumOffset,
      this.sumLateral,
      this.sumSqOffset,
      this.sumSqLateral,
      this.sumCross,
    ];
    for (let bin = 0; bin < this.bins; bin += 1) {
      if (this.count[bin] < SEED_RESIDUE) {
        this.count[bin] = 0;
        for (const sums of raw) sums[bin] = 0;
      }
      if (this.positiveCount[bin] < SEED_RESIDUE) {
        this.positiveCount[bin] = 0;
        this.positiveSum[bin] = 0;
      }
      if (this.negativeCount[bin] < SEED_RESIDUE) {
        this.negativeCount[bin] = 0;
        this.negativeSum[bin] = 0;
      }
      if (this.smoothCount[bin] < SEED_RESIDUE) {
        this.smoothCount[bin] = 0;
        this.smoothOffset[bin] = 0;
        this.smoothLateral[bin] = 0;
      }
      if (this.smoothPositiveCount[bin] < SEED_RESIDUE) {
        this.smoothPositiveCount[bin] = 0;
        this.smoothPositiveSum[bin] = 0;
      }
      if (this.smoothNegativeCount[bin] < SEED_RESIDUE) {
        this.smoothNegativeCount[bin] = 0;
        this.smoothNegativeSum[bin] = 0;
      }
    }
    this.edgeDirty.fill(1);
    this.edgeVersion += 1;
    this.dirty = true;
    this.signValue = null;
    this.lastCheck = null;
    this.sinceEvaluation = SIGN_EVALUATE_EVERY_SAMPLES;
  }

  private applySeed(stored: StoredTrackWidth, factor: 1 | -1): void {
    const sign = stored.sign;
    const leftCount = sign > 0 ? this.positiveCount : this.negativeCount;
    const leftSum = sign > 0 ? this.positiveSum : this.negativeSum;
    const rightCount = sign > 0 ? this.negativeCount : this.positiveCount;
    const rightSum = sign > 0 ? this.negativeSum : this.positiveSum;
    for (let bin = 0; bin < this.bins; bin += 1) {
      const centreWeight =
        Math.min(stored.centreCount[bin], SEED_WEIGHT) * factor;
      if (centreWeight !== 0) {
        const centre = stored.centre[bin] / 10;
        this.count[bin] += centreWeight;
        this.sumOffset[bin] += centre * centreWeight;
        this.spreadCentre(bin, centreWeight, centre, 0);
      }
      const leftWeight = Math.min(stored.leftCount[bin], SEED_WEIGHT) * factor;
      if (leftWeight !== 0) {
        const half = stored.left[bin] / 10;
        leftCount[bin] += leftWeight;
        leftSum[bin] += half * leftWeight;
        this.spreadSide(bin, sign > 0, leftWeight, half);
      }
      const rightWeight =
        Math.min(stored.rightCount[bin], SEED_WEIGHT) * factor;
      if (rightWeight !== 0) {
        const half = stored.right[bin] / 10;
        rightCount[bin] += rightWeight;
        rightSum[bin] += half * rightWeight;
        this.spreadSide(bin, sign < 0, rightWeight, half);
      }
    }
  }

  resolvedEdges(left: Float64Array, right: Float64Array): boolean {
    const sign = this.signValue;
    if (!this.line || sign === null || left.length < this.bins) return false;
    if (right.length < this.bins) return false;
    for (let bin = 0; bin < this.bins; bin += 1) {
      if (this.edgeDirty[bin] === 1) this.resolveBin(bin, sign);
      left[bin] = this.edgeLeft[bin];
      right[bin] = this.edgeRight[bin];
    }
    return true;
  }

  export(): StoredTrackWidth | null {
    const sign = this.signValue;
    if (!this.line || sign === null) return null;
    const { bins } = this;
    const stored: StoredTrackWidth = {
      version: TRACK_WIDTH_STORE_VERSION,
      bins,
      lapDistM: this.lapDistM,
      sign,
      centre: new Array<number>(bins).fill(0),
      left: new Array<number>(bins).fill(0),
      right: new Array<number>(bins).fill(0),
      centreCount: new Array<number>(bins).fill(0),
      leftCount: new Array<number>(bins).fill(0),
      rightCount: new Array<number>(bins).fill(0),
    };
    const leftCount = sign > 0 ? this.positiveCount : this.negativeCount;
    const leftSum = sign > 0 ? this.positiveSum : this.negativeSum;
    const rightCount = sign > 0 ? this.negativeCount : this.positiveCount;
    const rightSum = sign > 0 ? this.negativeSum : this.positiveSum;
    for (let bin = 0; bin < bins; bin += 1) {
      const n = this.count[bin];
      if (n > 0) {
        stored.centre[bin] = Math.round(
          ((this.sumOffset[bin] - sign * this.sumLateral[bin]) / n) * 10
        );
        stored.centreCount[bin] = Math.min(Math.round(n), MAX_STORED_COUNT);
      }
      if (leftCount[bin] > 0) {
        stored.left[bin] = Math.round((leftSum[bin] / leftCount[bin]) * 10);
        stored.leftCount[bin] = Math.min(
          Math.max(1, Math.round(leftCount[bin])),
          MAX_STORED_COUNT
        );
      }
      if (rightCount[bin] > 0) {
        stored.right[bin] = Math.round((rightSum[bin] / rightCount[bin]) * 10);
        stored.rightCount[bin] = Math.min(
          Math.max(1, Math.round(rightCount[bin])),
          MAX_STORED_COUNT
        );
      }
    }
    return stored;
  }

  fillWindow(playerPct: number, out: number[]): boolean {
    const { bins } = this;
    if (!this.line || this.signValue === null || bins === 0) return false;
    if (!finite(playerPct)) return false;
    const playerBin = Math.min(bins - 1, Math.floor(wrap01(playerPct) * bins));
    if (
      playerBin !== this.windowBin ||
      this.edgeVersion !== this.windowVersion
    ) {
      this.windowBin = playerBin;
      this.windowVersion = this.edgeVersion;
      if (!this.buildWindow(playerBin, this.signValue, this.window)) {
        this.window.length = 0;
      }
    }
    if (this.window.length === 0) return false;
    out.length = this.window.length;
    for (let index = 0; index < this.window.length; index += 1) {
      out[index] = this.window[index];
    }
    return true;
  }

  private buildWindow(playerBin: number, sign: Sign, out: number[]): boolean {
    const { bins } = this;
    const binM = this.lapDistM / bins;
    const half = Math.max(1, Math.round(ROAD_EDGES_REACH_M / binM));
    const margin = Math.max(1, Math.ceil(GAP_FILL_M / binM));
    const count = half * 2 + 1;
    const span = count + margin * 2;
    if (this.resolvedLeft.length < span) {
      this.resolvedLeft = new Float64Array(span);
      this.resolvedRight = new Float64Array(span);
    }
    const left = this.resolvedLeft;
    const right = this.resolvedRight;
    const firstBin = playerBin - half - margin;
    let known = 0;
    let bin = ((firstBin % bins) + bins) % bins;
    for (let index = 0; index < span; index += 1) {
      if (this.edgeDirty[bin] === 1) this.resolveBin(bin, sign);
      left[index] = this.edgeLeft[bin];
      right[index] = this.edgeRight[bin];
      if (finite(left[index])) known += 1;
      bin += 1;
      if (bin >= bins) bin = 0;
    }
    if (known === 0) return false;

    out.length = ROAD_EDGES_HEADER + count * 2;
    out[0] = wrap01((playerBin - half + 0.5) / bins);
    out[1] = 1 / bins;
    out[2] = count;
    let previous = -1;
    for (let index = 0; index < span; index += 1) {
      if (finite(left[index])) previous = index;
      if (index < margin || index >= margin + count) continue;
      const slot = index - margin;
      if (finite(left[index])) {
        out[ROAD_EDGES_HEADER + slot] = Math.round(left[index] * 10) / 10;
        out[ROAD_EDGES_HEADER + count + slot] =
          Math.round(right[index] * 10) / 10;
        continue;
      }
      let next = -1;
      for (
        let ahead = index + 1;
        ahead < span && ahead - index <= margin;
        ahead += 1
      ) {
        if (finite(left[ahead])) {
          next = ahead;
          break;
        }
      }
      const before = previous >= 0 && index - previous <= margin;
      const after = next >= 0;
      let leftValue = Number.NaN;
      let rightValue = Number.NaN;
      if (before && after) {
        const amount = (index - previous) / (next - previous);
        leftValue = left[previous] + (left[next] - left[previous]) * amount;
        rightValue = right[previous] + (right[next] - right[previous]) * amount;
      } else if (before) {
        leftValue = left[previous];
        rightValue = right[previous];
      } else if (after) {
        leftValue = left[next];
        rightValue = right[next];
      }
      out[ROAD_EDGES_HEADER + slot] = finite(leftValue)
        ? Math.round(leftValue * 10) / 10
        : Number.NaN;
      out[ROAD_EDGES_HEADER + count + slot] = finite(rightValue)
        ? Math.round(rightValue * 10) / 10
        : Number.NaN;
    }
    return true;
  }
}

export function lmuOffTrackFlags(
  pathLateral: ArrayLike<number> | undefined,
  trackEdge: ArrayLike<number> | undefined,
  inPits: ArrayLike<number>,
  inGarageStall: ArrayLike<number>,
  out: number[]
): number[] {
  if (!pathLateral || !trackEdge) {
    out.length = 0;
    return out;
  }
  const length = Math.min(pathLateral.length, trackEdge.length);
  for (let carIdx = 0; carIdx < length; carIdx += 1) {
    const lateral = pathLateral[carIdx];
    const edge = trackEdge[carIdx];
    out[carIdx] =
      finite(lateral) &&
      finite(edge) &&
      Math.abs(edge) > 0 &&
      inPits[carIdx] !== 1 &&
      inGarageStall[carIdx] !== 1 &&
      Math.abs(lateral) - Math.abs(edge) > OFF_TRACK_MARGIN_M
        ? 1
        : 0;
  }
  out.length = length;
  return out;
}

export interface TrackWidthStorage {
  loadTrackWidth: (trackName: string) => unknown;
  saveTrackWidth: (trackName: string, width: StoredTrackWidth) => boolean;
}

export interface TrackWidthLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
}

export interface TrackWidthFrame extends TrackWidthSampleInput {
  map: LmuTrackMap | null;
  fit: MapRegistrationFit | null;
  cacheable: boolean;
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const describeCoverage = (profile: LmuTrackWidthProfile): string =>
  `${percent(profile.coverage())} of the lap with both edges measured or interpolated, ${percent(profile.supportedCoverage())} with both smoothed edges`;

const describeDiagnostics = (profile: LmuTrackWidthProfile): string => {
  const d = profile.diagnostics();
  return `samples from you: left ${d.playerLeft}, right ${d.playerRight}; from other drivers: left ${d.othersLeft}, right ${d.othersRight}; ${d.interpolated} stretches interpolated; ${d.rejected} outliers dropped; ${d.otherDriversWithEdge} of ${d.otherDriversSeen} other drivers report a track edge`;
};

export class LmuTrackWidth {
  private trackName = '';
  private map: LmuTrackMap | null = null;
  private fit: MapRegistrationFit | null = null;
  private lapDistM = 0;
  private cacheable = false;
  private announced = false;
  private dirty = false;
  private savedCoverage = 0;
  private lastSaveTime = Number.NEGATIVE_INFINITY;
  private checkedSeed: StoredTrackWidth | null = null;
  private seedSource: 'bundle' | 'cache' = 'bundle';
  private line: LmuDrawnLine | null = null;
  private mode: 'learn' | 'checkBundle' | 'bundle' = 'learn';
  private readonly profile = new LmuTrackWidthProfile();

  constructor(
    private readonly storage: TrackWidthStorage,
    private readonly log: TrackWidthLogger,
    private readonly bundle: TrackWidthBundle | null = null,
    private readonly learnBundled = false
  ) {}

  get seededFromBundle(): boolean {
    return this.checkedSeed !== null && this.seedSource === 'bundle';
  }

  get learning(): boolean {
    return this.mode !== 'bundle';
  }

  get status(): TrackWidthStatus {
    return this.profile.status;
  }

  get sign(): Sign | null {
    return this.profile.sign;
  }

  coverage(): number {
    return this.profile.coverage();
  }

  setTrack(trackName: string): void {
    this.flush();
    this.trackName = trackName;
    this.map = null;
    this.fit = null;
    this.lapDistM = 0;
    this.cacheable = false;
    this.announced = false;
    this.dirty = false;
    this.savedCoverage = 0;
    this.lastSaveTime = Number.NEGATIVE_INFINITY;
    this.checkedSeed = null;
    this.line = null;
    this.mode = 'learn';
    this.profile.reset(null, 0);
  }

  update(frame: TrackWidthFrame): void {
    if (
      frame.map !== this.map ||
      frame.fit !== this.fit ||
      frame.lapDistM !== this.lapDistM
    ) {
      this.useLine(frame);
    }
    if (this.mode === 'bundle') return;
    if (this.profile.update(frame)) this.dirty = true;
    this.checkBundle();
    this.announce();
    if (
      this.mode === 'learn' &&
      this.cacheable &&
      this.dirty &&
      this.profile.sign !== null &&
      frame.time - this.lastSaveTime >= SAVE_MIN_INTERVAL_S &&
      this.profile.coverage() - this.savedCoverage >= SAVE_MIN_COVERAGE_GAIN
    ) {
      this.save(frame.time);
    }
  }

  fillRoadEdges(playerPct: number, out: number[]): boolean {
    return this.profile.fillWindow(playerPct, out);
  }

  flush(): void {
    if (
      this.mode === 'learn' &&
      this.cacheable &&
      this.dirty &&
      this.profile.sign !== null
    ) {
      this.save(this.lastSaveTime);
    }
  }

  private useLine(frame: TrackWidthFrame): void {
    this.map = frame.map;
    this.fit = frame.fit;
    this.lapDistM = frame.lapDistM;
    this.cacheable = frame.cacheable;
    this.announced = false;
    this.dirty = false;
    this.savedCoverage = 0;
    this.lastSaveTime = frame.time;
    this.checkedSeed = null;
    this.mode = 'learn';
    const points = frame.map?.active.trackPathPoints;
    const line =
      frame.fit && points && points.length >= 2
        ? new LmuDrawnLine(points, frame.fit)
        : null;
    this.line = line;
    this.profile.reset(line, frame.lapDistM);
    if (!line || !this.trackName) return;
    if (this.learnBundled) {
      if (frame.cacheable && this.seedFromCache()) return;
      this.seedFromBundle(line, frame.lapDistM);
      return;
    }
    if (this.seedFromBundle(line, frame.lapDistM)) {
      this.mode = 'checkBundle';
      return;
    }
    if (frame.cacheable) this.seedFromCache();
  }

  private seedFromCache(): boolean {
    const stored = parseStoredTrackWidth(
      this.storage.loadTrackWidth(this.trackName)
    );
    if (!stored || !this.profile.seed(stored)) return false;
    this.checkedSeed = stored;
    this.seedSource = 'cache';
    this.profile.setReference(stored);
    this.savedCoverage = this.profile.coverage();
    this.announced = true;
    this.log.info(
      `[lmuTrackWidth] Track width for ${this.trackName} loaded from the cache: ${describeCoverage(this.profile)}, LMU lateral sign ${stored.sign > 0 ? '+1' : '-1'}`
    );
    return true;
  }

  private seedFromBundle(line: LmuDrawnLine, lapDistM: number): boolean {
    const entry = this.bundle?.trackWidth(this.trackName, lapDistM);
    if (!entry) return false;
    const stored = storedTrackWidthFromBundle(entry.width, line, lapDistM);
    if (!stored || !this.profile.seed(stored)) return false;
    this.checkedSeed = stored;
    this.seedSource = 'bundle';
    this.profile.setReference(stored);
    this.savedCoverage = this.profile.coverage();
    this.announced = true;
    this.log.info(
      `[lmuTrackWidth] Track width for ${this.trackName} from the bundle: ${percent(entry.smoothedCoverage)} with both edges, ${entry.samples} samples, made with irdashies ${entry.irdashiesVersion}`
    );
    return true;
  }

  private checkBundle(): void {
    const seed = this.checkedSeed;
    if (!seed) return;
    const check = this.profile.referenceCheck();
    if (!check) return;
    this.checkedSeed = null;
    this.profile.setReference(null);
    const source = this.seedSource === 'bundle' ? 'Bundled' : 'Cached';
    if (!check.agrees) {
      this.profile.unseed(seed);
      this.dirty = true;
      this.mode = 'learn';
      this.log.warn(
        `[lmuTrackWidth] ${source} track width for ${this.trackName} dropped: live edges are ${check.medianM.toFixed(1)} m from it (median of ${check.samples} samples); learning live only`
      );
      return;
    }
    const confirmed = `[lmuTrackWidth] ${source} track width for ${this.trackName} confirmed: live edges within ${check.medianM.toFixed(1)} m (median of ${check.samples} samples)`;
    if (this.mode !== 'checkBundle') {
      this.log.info(confirmed);
      return;
    }
    this.profile.reset(this.line, this.lapDistM);
    this.profile.seed(seed);
    this.dirty = false;
    this.mode = 'bundle';
    this.log.info(`${confirmed}; learning off`);
  }

  private announce(): void {
    if (this.announced) return;
    const check = this.profile.signCheck;
    if (this.profile.sign !== null && check) {
      this.announced = true;
      this.log.info(
        `[lmuTrackWidth] Track width for ${this.trackName}: LMU lateral sign ${check.sign === 1 ? '+1 (positive left)' : '-1 (positive right)'}, slope ${check.slope.toFixed(2)}, within-bin correlation ${check.correlation.toFixed(2)}, residual ${check.residualM.toFixed(2)} m, ${check.samples} samples`
      );
    } else if (this.profile.status === 'refused') {
      this.announced = true;
      this.log.warn(
        `[lmuTrackWidth] Track width for ${this.trackName} not used: LMU lateral does not follow the cars (${check ? `slope ${check.slope.toFixed(2)}, within-bin correlation ${check.correlation.toFixed(2)}` : 'no check'}); keeping the fixed road width`
      );
    }
  }

  private save(time: number): void {
    const stored = this.profile.export();
    if (!stored || !this.trackName) return;
    this.lastSaveTime = time;
    const coverage = this.profile.coverage();
    try {
      if (this.storage.saveTrackWidth(this.trackName, stored)) {
        this.dirty = false;
        this.savedCoverage = coverage;
        this.log.info(
          `[lmuTrackWidth] Saved track width for ${this.trackName}: ${describeCoverage(this.profile)}; ${describeDiagnostics(this.profile)}`
        );
      }
    } catch (error) {
      this.log.warn(
        `[lmuTrackWidth] Failed to save the track width for ${this.trackName}: ${String(error)}`
      );
    }
  }
}
