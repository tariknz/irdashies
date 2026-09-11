import { MAX_LAP_SAMPLES, type LapTraceSamples } from '@irdashies/types';

/**
 * The per-sample lap representation and the queries on it.
 *
 * A lap is the telemetry rows themselves, each with its own lap distance — the
 * live recorder, an .ibt file and a Garage 61 CSV all deliver exactly that, so
 * nothing is aggregated and nothing is quantised. Everything downstream (the
 * plot, corner timing, brake-cue selection) asks the same three questions:
 * "what was the value at distance d", "what was the minimum over [a, b]", and
 * "was [a, b] driven", all answered here by binary search and linear
 * interpolation along `distanceM`.
 *
 * SampleBuffer is the single writer. It enforces the one invariant the
 * searches need — strictly ascending distance — and reports what it did with
 * each sample so the recorder can decide whether the lap is still clean.
 */

/**
 * Two samples closer than this are the same position: a stationary car, or
 * float dust on LapDistPct. Dropped rather than stored, so the axis stays
 * strictly ascending.
 */
export const MIN_SAMPLE_SPACING_M = 0.01;

/**
 * Going backwards by less than this is noise (LapDistPct can dither a few cm
 * when stopped); more is a spin or a reset and the lap is no longer a lap.
 */
export const MAX_BACKWARD_M = 5;

/**
 * A jump larger than this between consecutive samples is a teleport, a tow,
 * or a dropped connection — nothing on wheels covers 50 m between frames even
 * at 25 Hz. The sample is kept (so the trace shows where the car reappeared)
 * but the lap is flagged.
 */
export const MAX_SAMPLE_GAP_M = 50;

/** Where a live buffer starts; it doubles from here up to MAX_LAP_SAMPLES. */
export const INITIAL_SAMPLE_CAPACITY = 4096;

/** Wraps any lap fraction into [0, 1). */
export function normalisePct(pct: number): number {
  return ((pct % 1) + 1) % 1;
}

export type PushResult =
  /** Stored. */
  | 'ok'
  /** Stored, but the jump from the previous sample was implausibly large. */
  | 'gap'
  /** Not stored: same position as the last sample, or a small wobble back. */
  | 'dropped'
  /** Not stored: the car went backwards by more than MAX_BACKWARD_M. */
  | 'backward'
  /** Not stored: the lap is at MAX_LAP_SAMPLES. */
  | 'full';

/**
 * Growable typed-array store for one lap. Allocates only when it doubles, so
 * after the first lap on a track a session never allocates again (R13.2);
 * `reset()` keeps the arrays and rewinds `length`.
 */
export class SampleBuffer implements LapTraceSamples {
  length = 0;
  distanceM: Float32Array;
  timeSec: Float32Array;
  throttle: Float32Array;
  brake: Float32Array;
  speed: Float32Array;
  gear: Float32Array;
  absActive: Float32Array;

  constructor(capacity = INITIAL_SAMPLE_CAPACITY) {
    const size = Math.max(1, Math.min(capacity, MAX_LAP_SAMPLES));
    this.distanceM = new Float32Array(size);
    this.timeSec = new Float32Array(size);
    this.throttle = new Float32Array(size);
    this.brake = new Float32Array(size);
    this.speed = new Float32Array(size);
    this.gear = new Float32Array(size);
    this.absActive = new Float32Array(size);
  }

  /** Distance of the newest sample, or -1 when empty. */
  lastDistanceM(): number {
    return this.length > 0 ? this.distanceM[this.length - 1] : -1;
  }

  push(
    distanceM: number,
    timeSec: number,
    throttle: number,
    brake: number,
    speed: number,
    gear: number,
    absActive: number
  ): PushResult {
    if (!Number.isFinite(distanceM) || !Number.isFinite(timeSec)) {
      return 'dropped';
    }
    if (this.length >= MAX_LAP_SAMPLES) return 'full';

    let result: PushResult = 'ok';
    if (this.length > 0) {
      const delta = distanceM - this.distanceM[this.length - 1];
      if (delta < MIN_SAMPLE_SPACING_M) {
        return delta < -MAX_BACKWARD_M ? 'backward' : 'dropped';
      }
      if (delta > MAX_SAMPLE_GAP_M) result = 'gap';
    }

    if (this.length === this.distanceM.length) this.grow();
    const i = this.length;
    this.distanceM[i] = distanceM;
    this.timeSec[i] = timeSec;
    this.throttle[i] = throttle;
    this.brake[i] = brake;
    this.speed[i] = speed;
    this.gear[i] = gear;
    this.absActive[i] = absActive;
    this.length = i + 1;
    return result;
  }

  reset(): void {
    this.length = 0;
  }

  /**
   * Overwrite `target` with the last `metres` of this buffer.
   *
   * Used at the start/finish line to carry the end of the finished lap into
   * the next one, so the driver's own trace can be drawn behind the line
   * instead of vanishing when the buffer rewinds. One sample before the cut is
   * included so the line enters the window from its edge rather than starting
   * inside it.
   *
   * The copy is deliberate: this buffer is reset in place and immediately
   * overwritten by the new lap, so a view onto it would not survive the next
   * frame.
   */
  copyTailInto(target: SampleBuffer, metres: number): void {
    target.reset();
    const n = this.length;
    if (n === 0 || !(metres > 0)) return;

    const cutoffM = this.distanceM[n - 1] - metres;
    const start = Math.max(0, indexAtOrBefore(this, cutoffM));
    for (let i = start; i < n; i++) {
      target.push(
        this.distanceM[i],
        this.timeSec[i],
        this.throttle[i],
        this.brake[i],
        this.speed[i],
        this.gear[i],
        this.absActive[i]
      );
    }
  }

  /** Exact-length copies, independent of this buffer, for persisting. */
  toRecordSamples(): LapTraceSamples {
    const n = this.length;
    return {
      length: n,
      distanceM: this.distanceM.slice(0, n),
      timeSec: this.timeSec.slice(0, n),
      throttle: this.throttle.slice(0, n),
      brake: this.brake.slice(0, n),
      speed: this.speed.slice(0, n),
      gear: this.gear.slice(0, n),
      absActive: this.absActive.slice(0, n),
    };
  }

  private grow(): void {
    const capacity = Math.min(this.distanceM.length * 2, MAX_LAP_SAMPLES);
    const extend = (source: Float32Array): Float32Array => {
      const next = new Float32Array(capacity);
      next.set(source);
      return next;
    };
    this.distanceM = extend(this.distanceM);
    this.timeSec = extend(this.timeSec);
    this.throttle = extend(this.throttle);
    this.brake = extend(this.brake);
    this.speed = extend(this.speed);
    this.gear = extend(this.gear);
    this.absActive = extend(this.absActive);
  }
}

/**
 * Index of the last sample at or before distance `d`, or -1 when `d` is before
 * the first sample. Binary search over the first `length` entries.
 */
export function indexAtOrBefore(samples: LapTraceSamples, d: number): number {
  const { distanceM } = samples;
  let lo = 0;
  let hi = samples.length - 1;
  if (hi < 0 || d < distanceM[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (distanceM[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Linear interpolation of `field` at distance `d`. NaN outside the range the
 * lap actually covers — callers must treat NaN as "not driven", never as 0.
 */
export function valueAtDistance(
  samples: LapTraceSamples,
  field: Float32Array,
  d: number
): number {
  const n = samples.length;
  if (n === 0) return Number.NaN;
  const { distanceM } = samples;
  if (!(d >= distanceM[0]) || !(d <= distanceM[n - 1])) return Number.NaN;
  const i = indexAtOrBefore(samples, d);
  if (i >= n - 1) return field[n - 1];
  const d0 = distanceM[i];
  const d1 = distanceM[i + 1];
  const t = (d - d0) / (d1 - d0);
  return field[i] + t * (field[i + 1] - field[i]);
}

/** Lap time at distance `d`, interpolated. NaN when `d` was not driven. */
export function timeAtDistance(samples: LapTraceSamples, d: number): number {
  return valueAtDistance(samples, samples.timeSec, d);
}

/**
 * Minimum of `field` over the closed range [fromM, toM]: the interior samples
 * plus the interpolated value at each boundary, so a range that starts halfway
 * down a braking zone sees the speed at its own start, not at the sample
 * before it. NaN when either end is outside the driven range.
 */
export function minOver(
  samples: LapTraceSamples,
  field: Float32Array,
  fromM: number,
  toM: number
): number {
  if (!(fromM <= toM)) return Number.NaN;
  let min = valueAtDistance(samples, field, fromM);
  const atEnd = valueAtDistance(samples, field, toM);
  if (Number.isNaN(min) || Number.isNaN(atEnd)) return Number.NaN;
  if (atEnd < min) min = atEnd;

  const { distanceM } = samples;
  const n = samples.length;
  for (let i = indexAtOrBefore(samples, fromM) + 1; i < n; i++) {
    if (distanceM[i] >= toM) break;
    if (field[i] < min) min = field[i];
  }
  return min;
}

/**
 * Whether the lap covers [fromM, toM] continuously: both ends are inside the
 * driven range and no two consecutive samples across it are further apart
 * than `maxGapM`. A lap that skipped part of a corner must not be timed
 * through it — interpolation across a hole would invent a result.
 */
export function samplesCover(
  samples: LapTraceSamples,
  fromM: number,
  toM: number,
  maxGapM: number = MAX_SAMPLE_GAP_M
): boolean {
  const n = samples.length;
  if (n < 2 || !(fromM <= toM)) return false;
  const { distanceM } = samples;
  if (fromM < distanceM[0] || toM > distanceM[n - 1]) return false;

  const start = indexAtOrBefore(samples, fromM);
  for (let i = start + 1; i < n; i++) {
    if (distanceM[i] - distanceM[i - 1] > maxGapM) return false;
    if (distanceM[i] >= toM) break;
  }
  return true;
}

/**
 * Index range of samples with fromM <= distance <= toM, inclusive, or null
 * when none fall inside.
 */
export function sampleRange(
  samples: LapTraceSamples,
  fromM: number,
  toM: number
): { start: number; end: number } | null {
  const n = samples.length;
  if (n === 0 || !(fromM <= toM)) return null;
  let start = indexAtOrBefore(samples, fromM);
  if (start < 0 || samples.distanceM[start] < fromM) start += 1;
  const end = indexAtOrBefore(samples, toM);
  if (start >= n || end < start) return null;
  return { start, end };
}

/**
 * Copy of the samples with every distance scaled by `ratio`, trimmed to
 * `length`. Used when a stored lap's track length differs from the live
 * session's (WeekendInfo.TrackLength is only 2dp on some tracks), so the
 * reference lines up with the car rather than drifting a metre per kilometre.
 */
export function scaleDistances(
  samples: LapTraceSamples,
  ratio: number
): LapTraceSamples {
  const n = samples.length;
  const distanceM = new Float32Array(n);
  for (let i = 0; i < n; i++) distanceM[i] = samples.distanceM[i] * ratio;
  return {
    length: n,
    distanceM,
    timeSec: samples.timeSec.slice(0, n),
    throttle: samples.throttle.slice(0, n),
    brake: samples.brake.slice(0, n),
    speed: samples.speed.slice(0, n),
    gear: samples.gear.slice(0, n),
    absActive: samples.absActive.slice(0, n),
  };
}
