import { useLayoutEffect, useRef, type RefObject } from 'react';
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

/**
 * Coalesce positional snapshots into RAF draws. Canvas owners mark invalidation
 * before this hook's layout effect when a resize/static rebuild clears pixels;
 * those commits and appearance-only commits must repaint before presentation.
 */
export const useProgressAnimation = (
  drivers: ProgressSource,
  draw: DrawProgress,
  maxFps?: number,
  canvasInvalidatedRef?: RefObject<boolean>
) => {
  const interpolatorRef = useRef<ProgressInterpolator | null>(null);
  const drawRef = useRef(draw);
  const frameRef = useRef(0);
  const lastDrawRef = useRef(0);
  const previousDriversRef = useRef<ProgressSource | null>(null);
  const scheduleRef = useRef<() => void>(() => undefined);
  const minFrameMs = maxFps && maxFps > 0 ? 1000 / maxFps : 0;

  if (!interpolatorRef.current) {
    interpolatorRef.current = new ProgressInterpolator();
  }

  // Keep a single pending frame across snapshots. Only a cap change or unmount
  // replaces the scheduler; position updates never restart the cap's clock.
  useLayoutEffect(() => {
    const interpolator = interpolatorRef.current;
    if (!interpolator) return;
    let frameTime = 0;
    const measuredFrame = () => {
      const active = interpolator.advance(frameTime);
      drawRef.current(interpolator.getValues(), interpolator.getCount());
      return active;
    };
    const frame = (now: number) => {
      frameRef.current = 0;
      if (minFrameMs > 0 && now - lastDrawRef.current < minFrameMs) {
        scheduleRef.current();
        return;
      }
      frameTime = now;
      lastDrawRef.current = now;
      if (
        perfMetrics.measure(
          'trackMapAnimationFrame',
          measuredFrame,
          'trackMapRafDraw'
        )
      ) {
        scheduleRef.current();
      }
    };
    scheduleRef.current = () => {
      if (frameRef.current === 0) {
        frameRef.current = requestAnimationFrame(frame);
      }
    };
    return () => {
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, [minFrameMs]);

  useLayoutEffect(() => {
    // Publish data only at commit so an interrupted render cannot leak into RAF.
    drawRef.current = draw;
    const interpolator = interpolatorRef.current;
    if (!interpolator) return;
    const firstCommit = previousDriversRef.current === null;
    const changed = previousDriversRef.current !== drivers;
    const now = performance.now();
    const active = changed
      ? interpolator.setTargets(drivers, now)
      : interpolator.advance(now);
    previousDriversRef.current = drivers;

    if (firstCommit || !changed || canvasInvalidatedRef?.current) {
      // The cap applies to animation, never to restoring a cleared canvas or
      // changing appearance while idle (including simultaneous new targets).
      if (canvasInvalidatedRef) canvasInvalidatedRef.current = false;
      lastDrawRef.current = now;
      perfMetrics.measure(
        'trackMapAnimationFrame',
        () => draw(interpolator.getValues(), interpolator.getCount()),
        'trackMapCommitDraw'
      );
      if (!active && frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    } else {
      // Even a settled snapshot can change the roster, labels or pit state.
      scheduleRef.current();
    }
    if (active) scheduleRef.current();
  });
};
