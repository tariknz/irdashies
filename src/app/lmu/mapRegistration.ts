import type { LmuTrackMap } from '@irdashies/types';

export const MAP_REGISTRATION_SAMPLE_INTERVAL_S = 0.1;
const MIN_SAMPLES = 300;
const EVALUATE_EVERY_SAMPLES = 50;
const REJECT_AFTER_SAMPLES = 3000;
const MAX_RMS_M = 8;
const MAX_SCALE_ERROR = 0.25;
const COVERAGE_BINS = 32;
const MIN_COVERED_BINS = 16;
const MIN_SAMPLE_SPEED_MS = 5;

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
}

interface Sums {
  sxr: number;
  sxi: number;
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
  private smx = 0;
  private smy = 0;
  private swx = 0;
  private swy = 0;
  private smm = 0;
  private sww = 0;
  private readonly normal: Sums = { sxr: 0, sxi: 0 };
  private readonly mirrored: Sums = { sxr: 0, sxi: 0 };
  private readonly point = { x: 0, y: 0 };
  private currentStatus: MapRegistrationStatus = 'collecting';
  private currentFit: MapRegistrationFit | null = null;
  private lastEvaluation: MapRegistrationFit | null = null;

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

  reset(map: LmuTrackMap | null = null): void {
    this.map = map;
    this.mapLength = map ? closedLength(map.active.trackPathPoints) : 0;
    this.lastSampleTime = Number.NEGATIVE_INFINITY;
    this.sinceEvaluation = 0;
    this.coverage = 0;
    this.n = 0;
    this.smx = 0;
    this.smy = 0;
    this.swx = 0;
    this.swy = 0;
    this.smm = 0;
    this.sww = 0;
    this.normal.sxr = 0;
    this.normal.sxi = 0;
    this.mirrored.sxr = 0;
    this.mirrored.sxi = 0;
    this.currentStatus = 'collecting';
    this.currentFit = null;
    this.lastEvaluation = null;
  }

  update(input: MapRegistrationInput): MapRegistrationFit | null {
    if (input.map !== this.map) this.reset(input.map);
    if (!this.map || this.currentStatus !== 'collecting') {
      return this.currentFit;
    }
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
      this.evaluate(input.trackLengthM);
    }
    return this.currentFit;
  }

  private sample(input: MapRegistrationInput): void {
    const points = this.map?.active.trackPathPoints;
    if (!points || points.length < 2) return;
    const count = Math.min(input.available.length, input.pcts.length);
    for (let carIdx = 0; carIdx < count; carIdx += 1) {
      if (input.available[carIdx] !== 1) continue;
      if (input.inPits?.[carIdx] === 1) continue;
      if (
        input.speeds !== undefined &&
        !(input.speeds[carIdx] >= MIN_SAMPLE_SPEED_MS)
      ) {
        continue;
      }
      const pct = input.pcts[carIdx];
      if (typeof pct !== 'number' || !(pct >= 0) || !(pct < 1)) continue;
      const wx = input.posX[carIdx];
      const wy = -input.posZ[carIdx];
      if (!Number.isFinite(wx) || !Number.isFinite(wy)) continue;

      const m = mapPointAt(points, pct, this.point);
      this.n += 1;
      this.sinceEvaluation += 1;
      this.smx += m.x;
      this.smy += m.y;
      this.swx += wx;
      this.swy += wy;
      this.smm += m.x * m.x + m.y * m.y;
      this.sww += wx * wx + wy * wy;
      this.normal.sxr += wx * m.x + wy * m.y;
      this.normal.sxi += wy * m.x - wx * m.y;
      this.mirrored.sxr += wx * m.x - wy * m.y;
      this.mirrored.sxi += wy * m.x + wx * m.y;
      this.coverage |=
        1 << Math.min(COVERAGE_BINS - 1, Math.floor(pct * COVERAGE_BINS));
    }
  }

  private coveredBins(): number {
    let bins = 0;
    for (let bit = 0; bit < COVERAGE_BINS; bit += 1) {
      if (this.coverage & (1 << bit)) bins += 1;
    }
    return bins;
  }

  private solve(sums: Sums, mirrored: boolean): MapRegistrationFit | null {
    const { n } = this;
    const mx = this.smx / n;
    const my = this.smy / n;
    const wx = this.swx / n;
    const wy = this.swy / n;
    const varM = this.smm - n * (mx * mx + my * my);
    const varW = this.sww - n * (wx * wx + wy * wy);
    if (!(varM > 0)) return null;
    const meanCrossR = mirrored ? wx * mx - wy * my : wx * mx + wy * my;
    const meanCrossI = mirrored ? wy * mx + wx * my : wy * mx - wx * my;
    const crossR = sums.sxr - n * meanCrossR;
    const crossI = sums.sxi - n * meanCrossI;
    const ar = crossR / varM;
    const ai = crossI / varM;
    const mappedX = mirrored ? ar * mx + ai * my : ar * mx - ai * my;
    const mappedY = mirrored ? ai * mx - ar * my : ai * mx + ar * my;
    const residual = Math.max(
      0,
      varW - (crossR * crossR + crossI * crossI) / varM
    );
    return {
      ar,
      ai,
      tx: wx - mappedX,
      ty: wy - mappedY,
      mirrored,
      rmsM: Math.sqrt(residual / n),
      metresPerUnit: Math.hypot(ar, ai),
      samples: n,
    };
  }

  private evaluate(trackLengthM: number): void {
    if (this.n < MIN_SAMPLES || this.coveredBins() < MIN_COVERED_BINS) return;
    const normal = this.solve(this.normal, false);
    const mirrored = this.solve(this.mirrored, true);
    const best =
      normal && mirrored
        ? normal.rmsM <= mirrored.rmsM
          ? normal
          : mirrored
        : (normal ?? mirrored);
    if (!best) return;
    this.lastEvaluation = best;

    const expectedScale =
      this.mapLength > 0 && trackLengthM > 0
        ? trackLengthM / this.mapLength
        : Number.NaN;
    const scaleOk =
      Number.isFinite(expectedScale) &&
      Math.abs(best.metresPerUnit / expectedScale - 1) <= MAX_SCALE_ERROR;
    if (best.rmsM <= MAX_RMS_M && scaleOk) {
      this.currentFit = best;
      this.currentStatus = 'accepted';
    } else if (this.n >= REJECT_AFTER_SAMPLES) {
      this.currentStatus = 'rejected';
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
