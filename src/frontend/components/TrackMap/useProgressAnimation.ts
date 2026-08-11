import { useLayoutEffect, useRef } from 'react';
import { perfMetrics } from '@irdashies/utils/perfMetrics';

export const TRACK_POSITION_INTERVAL_MS = 1000 / 25;
const MIN_POSITION_INTERVAL_MS = 1000 / 60;
const MAX_POSITION_INTERVAL_MS = 100;

type ProgressSource = readonly {
  progress: number;
  driver?: { CarIdx: number };
}[];
type DrawProgress = (progress: Float64Array, count: number) => void;

export const progressToFlatX = (
  progress: number,
  startX: number,
  usableWidth: number
) => startX + progress * usableWidth;

export const progressToTrackPoint = (
  progress: number,
  trackPathPoints: readonly { x: number; y: number }[],
  totalLength: number,
  intersectionLength: number,
  direction: 'clockwise' | 'anticlockwise' | null | undefined,
  output: { x: number; y: number }
) => {
  const adjustedLength = (totalLength * progress) % totalLength;
  const length =
    direction === 'anticlockwise'
      ? (intersectionLength + adjustedLength) % totalLength
      : (intersectionLength - adjustedLength + totalLength) % totalLength;
  const floatIndex = (length / totalLength) * (trackPathPoints.length - 1);
  const index1 = Math.floor(floatIndex);
  const index2 = Math.min(index1 + 1, trackPathPoints.length - 1);
  const amount = floatIndex - index1;
  const point1 = trackPathPoints[index1];
  const point2 = trackPathPoints[index2];
  output.x = point1.x + (point2.x - point1.x) * amount;
  output.y = point1.y + (point2.y - point1.y) * amount;
};

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

  constructor(private durationMs = TRACK_POSITION_INTERVAL_MS) {}

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

export const useProgressAnimation = (
  drivers: ProgressSource,
  draw: DrawProgress
) => {
  const interpolatorRef = useRef<ProgressInterpolator | null>(null);
  const drawRef = useRef(draw);
  const frameRef = useRef(0);
  const previousDriversRef = useRef<ProgressSource | null>(null);

  if (!interpolatorRef.current) {
    interpolatorRef.current = new ProgressInterpolator();
  }

  // Commit the latest draw callback before target updates or RAF work. Skip
  // the repaint when the target effect below will paint this same commit.
  useLayoutEffect(() => {
    drawRef.current = draw;
    if (previousDriversRef.current !== drivers) return;
    const interpolator = interpolatorRef.current;
    if (!interpolator) return;
    const drawCommittedAppearance = () =>
      draw(interpolator.getValues(), interpolator.getCount());
    perfMetrics.measure('trackMapAnimationFrame', drawCommittedAppearance);
  });

  useLayoutEffect(() => {
    const interpolator = interpolatorRef.current;
    if (!interpolator) return;
    previousDriversRef.current = drivers;

    let frameTime = 0;
    const measuredFrame = () => {
      const active = interpolator.advance(frameTime);
      drawRef.current(interpolator.getValues(), interpolator.getCount());
      return active;
    };
    const frame = (now: number) => {
      frameTime = now;
      const active = perfMetrics.measure(
        'trackMapAnimationFrame',
        measuredFrame
      );
      frameRef.current = active ? requestAnimationFrame(frame) : 0;
    };

    const active = interpolator.setTargets(drivers, performance.now());
    const drawSnapshot = () =>
      drawRef.current(interpolator.getValues(), interpolator.getCount());
    perfMetrics.measure('trackMapAnimationFrame', drawSnapshot);
    if (active && frameRef.current === 0) {
      frameRef.current = requestAnimationFrame(frame);
    }

    return () => {
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, [drivers]);
};
