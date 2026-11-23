import type { LmuTrackMap } from '@irdashies/types';

export const MAP_REGISTRATION_SAMPLE_INTERVAL_S = 0.1;
export const MAP_REGISTRATION_RETRY_S = 30;
export const MAP_REGISTRATION_MAX_ATTEMPTS = 5;
const MIN_SAMPLES = 300;
const EVALUATE_EVERY_SAMPLES = 50;
const REJECT_AFTER_SAMPLES = 3000;
const MAX_RMS_M = 8;
const MAX_SCALE_ERROR = 0.25;
const COVERAGE_BINS = 32;
const MIN_COVERED_BINS = 16;
const MIN_SAMPLE_SPEED_MS = 5;
const RESERVOIR_SIZE = 4000;
const TRIM_RESIDUAL_FACTOR = 3;
const MIN_TRIM_RESIDUAL_M = 5;
const MIN_INLIER_SHARE = 0.7;

export type MapRegistrationStatus = 'collecting' | 'accepted' | 'rejected';

export interface MapRegistrationFit {
  ar: number;
  ai: number;
  tx: number;
  ty: number;
  mirrored: boolean;
  rmsM: number;
  metresPerUnit: number;
  samples: number;
  inlierShare?: number;
}

export interface MapRegistrationInput {
  map: LmuTrackMap | null;
  time: number;
  trackLengthM: number;
  posX: ArrayLike<number>;
  posZ: ArrayLike<number>;
  available: ArrayLike<number>;
  pcts: readonly unknown[];
  inPits?: ArrayLike<number>;
  speeds?: ArrayLike<number>;
  valid?: ArrayLike<number>;
}

const closedLength = (points: readonly { x: number; y: number }[]): number => {
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    length += Math.hypot(next.x - points[index].x, next.y - points[index].y);
  }
  return length;
};

export const mapPointAt = (
  points: readonly { x: number; y: number }[],
  pct: number,
  output: { x: number; y: number }
): { x: number; y: number } => {
  const count = points.length;
  const wrapped = ((pct % 1) + 1) % 1;
  const floatIndex = wrapped * count;
  const index = Math.floor(floatIndex) % count;
  const next = (index + 1) % count;
  const amount = floatIndex - Math.floor(floatIndex);
  output.x = points[index].x + (points[next].x - points[index].x) * amount;
  output.y = points[index].y + (points[next].y - points[index].y) * amount;
  return output;
};

export class LmuMapRegistration {
  private map: LmuTrackMap | null = null;
  private mapLength = 0;
  private lastSampleTime = Number.NEGATIVE_INFINITY;
  private sinceEvaluation = 0;
  private coverage = 0;
  private n = 0;
  private stored = 0;
  private random = 1;
  private readonly mx = new Float64Array(RESERVOIR_SIZE);
  private readonly my = new Float64Array(RESERVOIR_SIZE);
  private readonly wx = new Float64Array(RESERVOIR_SIZE);
  private readonly wy = new Float64Array(RESERVOIR_SIZE);
  private readonly residuals = new Float64Array(RESERVOIR_SIZE);
  private readonly sorted = new Float64Array(RESERVOIR_SIZE);
  private readonly inliers = new Uint8Array(RESERVOIR_SIZE);
  private readonly point = { x: 0, y: 0 };
  private currentStatus: MapRegistrationStatus = 'collecting';
  private currentFit: MapRegistrationFit | null = null;
  private lastEvaluation: MapRegistrationFit | null = null;
  private attemptCount = 1;
  private retryAt = Number.POSITIVE_INFINITY;

  get status(): MapRegistrationStatus {
    return this.currentStatus;
  }

  get fit(): MapRegistrationFit | null {
    return this.currentFit;
  }

  get lastAttempt(): MapRegistrationFit | null {
    return this.lastEvaluation;
  }

  get samples(): number {
    return this.n;
  }

  get attempt(): number {
    return this.attemptCount;
  }

  get finallyRejected(): boolean {
    return (
      this.currentStatus === 'rejected' &&
      this.attemptCount >= MAP_REGISTRATION_MAX_ATTEMPTS
    );
  }

  reset(map: LmuTrackMap | null = null): void {
    this.map = map;
    this.mapLength = map ? closedLength(map.active.trackPathPoints) : 0;
    this.attemptCount = 1;
    this.clearSamples();
  }

  restart(): void {
    if (this.currentStatus === 'accepted') return;
    this.attemptCount = 1;
    this.clearSamples();
  }

  update(input: MapRegistrationInput): MapRegistrationFit | null {
    if (input.map !== this.map) this.reset(input.map);
    if (!this.map) return this.currentFit;
    if (this.currentStatus === 'rejected' && input.time >= this.retryAt) {
      this.attemptCount += 1;
      this.clearSamples();
    }
    if (this.currentStatus !== 'collecting') return this.currentFit;
    if (input.time < this.lastSampleTime) {
      this.lastSampleTime = Number.NEGATIVE_INFINITY;
    }
    if (input.time - this.lastSampleTime < MAP_REGISTRATION_SAMPLE_INTERVAL_S) {
      return null;
    }
    this.lastSampleTime = input.time;
    this.sample(input);
    if (this.sinceEvaluation >= EVALUATE_EVERY_SAMPLES) {
      this.sinceEvaluation = 0;
      this.evaluate(input.trackLengthM, input.time);
    }
    return this.currentFit;
  }

  private clearSamples(): void {
    this.lastSampleTime = Number.NEGATIVE_INFINITY;
    this.sinceEvaluation = 0;
    this.coverage = 0;
    this.n = 0;
    this.stored = 0;
    this.random = 1;
    this.currentStatus = 'collecting';
    this.currentFit = null;
    this.lastEvaluation = null;
    this.retryAt = Number.POSITIVE_INFINITY;
  }

  private nextRandom(): number {
    this.random = (Math.imul(this.random, 1664525) + 1013904223) >>> 0;
    return this.random;
  }

  private sample(input: MapRegistrationInput): void {
    const points = this.map?.active.trackPathPoints;
    if (!points || points.length < 2) return;
    const count = Math.min(input.available.length, input.pcts.length);
    for (let carIdx = 0; carIdx < count; carIdx += 1) {
      if (input.available[carIdx] !== 1) continue;
      if (input.valid !== undefined && input.valid[carIdx] !== 1) continue;
      if (input.inPits?.[carIdx] === 1) continue;
      if (
        input.speeds !== undefined &&
        !(input.speeds[carIdx] >= MIN_SAMPLE_SPEED_MS)
      ) {
        continue;
      }
      const pct = input.pcts[carIdx];
      if (typeof pct !== 'number' || !(pct > 0) || !(pct < 1)) continue;
      const wx = input.posX[carIdx];
      const wy = -input.posZ[carIdx];
      if (!Number.isFinite(wx) || !Number.isFinite(wy)) continue;

      const m = mapPointAt(points, pct, this.point);
      this.n += 1;
      this.sinceEvaluation += 1;
      this.coverage |=
        1 << Math.min(COVERAGE_BINS - 1, Math.floor(pct * COVERAGE_BINS));
      let slot = -1;
      if (this.stored < RESERVOIR_SIZE) {
        slot = this.stored;
        this.stored += 1;
      } else {
        const pick = this.nextRandom() % this.n;
        if (pick < RESERVOIR_SIZE) slot = pick;
      }
      if (slot >= 0) {
        this.mx[slot] = m.x;
        this.my[slot] = m.y;
        this.wx[slot] = wx;
        this.wy[slot] = wy;
      }
    }
  }

  private coveredBins(): number {
    let bins = 0;
    for (let bit = 0; bit < COVERAGE_BINS; bit += 1) {
      if (this.coverage & (1 << bit)) bins += 1;
    }
    return bins;
  }

  private solve(
    mirrored: boolean,
    useInliers: boolean
  ): MapRegistrationFit | null {
    let n = 0;
    let smx = 0;
    let smy = 0;
    let swx = 0;
    let swy = 0;
    let smm = 0;
    let sww = 0;
    let sxr = 0;
    let sxi = 0;
    for (let index = 0; index < this.stored; index += 1) {
      if (useInliers && this.inliers[index] !== 1) continue;
      const mx = this.mx[index];
      const my = mirrored ? -this.my[index] : this.my[index];
      const wx = this.wx[index];
      const wy = this.wy[index];
      n += 1;
      smx += mx;
      smy += my;
      swx += wx;
      swy += wy;
      smm += mx * mx + my * my;
      sww += wx * wx + wy * wy;
      sxr += wx * mx + wy * my;
      sxi += wy * mx - wx * my;
    }
    if (n < 3) return null;
    const mx = smx / n;
    const my = smy / n;
    const wx = swx / n;
    const wy = swy / n;
    const varM = smm - n * (mx * mx + my * my);
    const varW = sww - n * (wx * wx + wy * wy);
    if (!(varM > 0)) return null;
    const crossR = sxr - n * (wx * mx + wy * my);
    const crossI = sxi - n * (wy * mx - wx * my);
    const ar = crossR / varM;
    const ai = crossI / varM;
    const residual = Math.max(
      0,
      varW - (crossR * crossR + crossI * crossI) / varM
    );
    return {
      ar,
      ai,
      tx: wx - (ar * mx - ai * my),
      ty: wy - (ai * mx + ar * my),
      mirrored,
      rmsM: Math.sqrt(residual / n),
      metresPerUnit: Math.hypot(ar, ai),
      samples: this.n,
    };
  }

  private best(useInliers: boolean): MapRegistrationFit | null {
    const normal = this.solve(false, useInliers);
    const mirrored = this.solve(true, useInliers);
    return normal && mirrored
      ? normal.rmsM <= mirrored.rmsM
        ? normal
        : mirrored
      : (normal ?? mirrored);
  }

  private markInliers(fit: MapRegistrationFit): number {
    const { ar, ai, tx, ty, mirrored } = fit;
    for (let index = 0; index < this.stored; index += 1) {
      const mx = this.mx[index];
      const my = mirrored ? -this.my[index] : this.my[index];
      const px = ar * mx - ai * my + tx;
      const py = ai * mx + ar * my + ty;
      const residual = Math.hypot(this.wx[index] - px, this.wy[index] - py);
      this.residuals[index] = residual;
      this.sorted[index] = residual;
    }
    const sorted = this.sorted.subarray(0, this.stored).sort();
    const median = sorted[Math.floor(this.stored / 2)];
    const limit = Math.max(MIN_TRIM_RESIDUAL_M, TRIM_RESIDUAL_FACTOR * median);
    let kept = 0;
    for (let index = 0; index < this.stored; index += 1) {
      const inlier = this.residuals[index] <= limit ? 1 : 0;
      this.inliers[index] = inlier;
      kept += inlier;
    }
    return kept;
  }

  private evaluate(trackLengthM: number, time: number): void {
    if (this.n < MIN_SAMPLES || this.coveredBins() < MIN_COVERED_BINS) return;
    const first = this.best(false);
    if (!first) return;
    const kept = this.markInliers(first);
    const refit = kept >= 3 ? this.best(true) : null;
    const best = refit ?? first;
    const inlierShare = this.stored > 0 ? kept / this.stored : 0;
    const attempt = { ...best, inlierShare };
    this.lastEvaluation = attempt;

    const expectedScale =
      this.mapLength > 0 && trackLengthM > 0
        ? trackLengthM / this.mapLength
        : Number.NaN;
    const scaleOk =
      Number.isFinite(expectedScale) &&
      Math.abs(attempt.metresPerUnit / expectedScale - 1) <= MAX_SCALE_ERROR;
    if (
      attempt.rmsM <= MAX_RMS_M &&
      scaleOk &&
      inlierShare >= MIN_INLIER_SHARE
    ) {
      this.currentFit = attempt;
      this.currentStatus = 'accepted';
    } else if (this.n >= REJECT_AFTER_SAMPLES) {
      this.currentStatus = 'rejected';
      this.retryAt =
        this.attemptCount < MAP_REGISTRATION_MAX_ATTEMPTS
          ? time + MAP_REGISTRATION_RETRY_S
          : Number.POSITIVE_INFINITY;
    }
  }
}

export const radarMapFrame = (
  fit: MapRegistrationFit,
  playerX: number,
  playerZ: number,
  playerYaw: number
): number[] | null => {
  const gx = playerX;
  const gy = -playerZ;
  if (![gx, gy, playerYaw].every(Number.isFinite)) return null;
  const { ar, ai, tx, ty, mirrored } = fit;
  const scaleSq = ar * ar + ai * ai;
  if (!(scaleSq > 0)) return null;

  const dx = gx - tx;
  const dy = gy - ty;
  const qx = (dx * ar + dy * ai) / scaleSq;
  const qy = (dy * ar - dx * ai) / scaleSq;
  const originX = qx;
  const originY = mirrored ? -qy : qy;

  const a00 = ar;
  const a01 = mirrored ? ai : -ai;
  const a10 = ai;
  const a11 = mirrored ? -ar : ar;

  const c = Math.cos(playerYaw - Math.PI);
  const s = Math.sin(playerYaw - Math.PI);
  return [
    originX,
    originY,
    c * a00 - s * a10,
    c * a01 - s * a11,
    -s * a00 - c * a10,
    -s * a01 - c * a11,
  ];
};
