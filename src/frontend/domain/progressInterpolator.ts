/**
 * Frame-rate-independent interpolation primitives shared by the track map and
 * the radar.
 */

export const PROGRESS_INTERVAL_MS = 1000 / 25;
const MIN_POSITION_INTERVAL_MS = 1000 / 60;
const MAX_POSITION_INTERVAL_MS = 100;

export type ProgressSource = readonly {
  progress: number;
  driver?: { CarIdx: number };
}[];
export type DrawProgress = (progress: Float64Array, count: number) => void;

const wrapProgress = (progress: number) => {
  const wrapped = progress % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
};

/**
 * Allocation-free interpolation state for the track-map RAF hot path.
 * Buffers only grow when the driver roster grows; advance() mutates them.
 */
export class ProgressInterpolator {
  private starts = new Float64Array(0);
  private targets = new Float64Array(0);
  private values = new Float64Array(0);
  private previousValues = new Float64Array(0);
  private driverIds = new Int32Array(0);
  private previousDriverIds = new Int32Array(0);
  private count = 0;
  private startedAt = 0;
  private lastTargetsAt = -1;
  private initialized = false;

  constructor(private durationMs = PROGRESS_INTERVAL_MS) {}

  setTargets(source: ProgressSource, now: number): boolean {
    if (this.initialized) this.advance(now);
    if (this.lastTargetsAt >= 0 && now > this.lastTargetsAt) {
      this.durationMs = Math.min(
        MAX_POSITION_INTERVAL_MS,
        Math.max(MIN_POSITION_INTERVAL_MS, now - this.lastTargetsAt)
      );
    }
    this.lastTargetsAt = now;
    this.ensureCapacity(source.length);
    const previousCount = this.count;
    for (let i = 0; i < previousCount; i++) {
      this.previousValues[i] = this.values[i];
      this.previousDriverIds[i] = this.driverIds[i];
    }
    this.count = source.length;

    for (let i = 0; i < this.count; i++) {
      const target = wrapProgress(source[i].progress);
      const driverId = source[i].driver?.CarIdx ?? i;
      let previousIndex = -1;
      if (this.initialized) {
        for (let j = 0; j < previousCount; j++) {
          if (this.previousDriverIds[j] === driverId) {
            previousIndex = j;
            break;
          }
        }
      }
      this.values[i] =
        previousIndex === -1 ? target : this.previousValues[previousIndex];
      this.starts[i] = this.values[i];
      this.targets[i] = target;
      this.driverIds[i] = driverId;
    }

    this.startedAt = now;
    this.initialized = true;
    return this.hasMovement();
  }

  advance(now: number): boolean {
    if (!this.initialized) return false;
    const elapsed = Math.max(0, now - this.startedAt);
    const amount = Math.min(1, elapsed / this.durationMs);

    for (let i = 0; i < this.count; i++) {
      let delta = this.targets[i] - this.starts[i];
      if (delta > 0.5) delta -= 1;
      else if (delta < -0.5) delta += 1;
      this.values[i] = wrapProgress(this.starts[i] + delta * amount);
    }

    return amount < 1 && this.hasMovement();
  }

  getValues(): Float64Array {
    return this.values;
  }

  getCount(): number {
    return this.count;
  }

  private hasMovement(): boolean {
    for (let i = 0; i < this.count; i++) {
      let delta = this.targets[i] - this.starts[i];
      if (delta > 0.5) delta -= 1;
      else if (delta < -0.5) delta += 1;
      if (Math.abs(delta) > Number.EPSILON) return true;
    }
    return false;
  }

  private ensureCapacity(count: number) {
    if (this.values.length >= count) return;
    const starts = new Float64Array(count);
    const targets = new Float64Array(count);
    const values = new Float64Array(count);
    const driverIds = new Int32Array(count);
    starts.set(this.starts);
    targets.set(this.targets);
    values.set(this.values);
    driverIds.set(this.driverIds);
    this.starts = starts;
    this.targets = targets;
    this.values = values;
    this.previousValues = new Float64Array(count);
    this.driverIds = driverIds;
    this.previousDriverIds = new Int32Array(count);
  }
}

export const progressToFlatX = (
  progress: number,
  startX: number,
  usableWidth: number
) => startX + progress * usableWidth;
