import { useLayoutEffect, useRef } from 'react';
import { perfMetrics } from '@irdashies/utils/perfMetrics';
import { ProgressInterpolator } from '@irdashies/domain/progressInterpolator';
import type { RadarBlip } from '../radarBlips';

/**
 * Where the blips are at paint time, in metres: one entry per blip, in the same
 * order as the blips themselves.
 *
 * The two axes are handed over as one value rather than two positional
 * arguments so that `blips[i]` and `positions[i]` are the same car by
 * construction. As two parallel arrays they were the same car only by the two
 * happening to line up, and nothing said so to the code that read them.
 *
 * The buffers are reused between frames and only grow, so only the first `count`
 * entries are meaningful.
 */
export interface RadarDrawPositions {
  /** Metres along the road; positive is ahead of the player. */
  readonly alongM: Float64Array;
  /** Metres to the driver's right, negative to the left. */
  readonly lateralM: Float64Array;
  /** How many blips the entries above describe. */
  readonly count: number;
}

export type RadarMotionDraw = (positions: RadarDrawPositions) => void;

interface MotionTarget {
  progress: number;
  driver: { CarIdx: number };
}

const updateTargets = (
  targets: MotionTarget[],
  blips: readonly RadarBlip[],
  trackLengthM: number,
  pick: (blip: RadarBlip) => number
): void => {
  targets.length = blips.length;
  for (let index = 0; index < blips.length; index += 1) {
    const blip = blips[index];
    const target = (targets[index] ??= {
      progress: 0,
      driver: { CarIdx: 0 },
    });
    target.progress = pick(blip) / trackLengthM;
    target.driver.CarIdx = blip.carIdx;
  }
};
/**
 * The interpolator stores lap fractions, so it wraps to [0, 1) and a blip four
 * metres behind the player is stored as 0.9992. Scaling that back would paint
 * the car a lap ahead, so the signed offset is recovered as the shortest delta
 * — the same ±0.5 of a unit the interpolator itself wraps at. Blips are
 * filtered to the radar's range, a few metres, so the shortest delta is always
 * the offset that went in.
 */
const unwrapFraction = (value: number): number =>
  value > 0.5 ? value - 1 : value;

/**
 * Glides the blips between 25 Hz snapshots at display refresh rate, reusing
 * the track map's interpolator so its duration adapts to the observed
 * snapshot cadence. Only geometry is smoothed: colour and labels stay instant
 * from the snapshot. The interpolator works in lap fractions (it wraps at
 * ±0.5 of its unit), so targets are divided by the track length and the
 * interpolated values are unwrapped and scaled back to metres before drawing.
 */
export const useRadarMotion = (
  blips: readonly RadarBlip[],
  trackLengthM: number,
  draw: RadarMotionDraw,
  pulseActive: boolean
): void => {
  const alongRef = useRef<ProgressInterpolator | null>(null);
  const lateralRef = useRef<ProgressInterpolator | null>(null);
  const alongMRef = useRef(new Float64Array(0));
  const lateralMRef = useRef(new Float64Array(0));
  const alongTargetsRef = useRef<MotionTarget[]>([]);
  const lateralTargetsRef = useRef<MotionTarget[]>([]);
  const drawRef = useRef(draw);
  const trackLengthRef = useRef(trackLengthM);
  const frameRef = useRef(0);

  if (!alongRef.current) {
    alongRef.current = new ProgressInterpolator();
  }
  if (!lateralRef.current) {
    lateralRef.current = new ProgressInterpolator();
  }

  // Commit the latest callbacks and props without restarting the RAF loop.
  useLayoutEffect(() => {
    drawRef.current = draw;
    trackLengthRef.current = trackLengthM;
  });

  useLayoutEffect(() => {
    const along = alongRef.current;
    const lateral = lateralRef.current;
    if (!along || !lateral) return;

    const now = performance.now();
    updateTargets(
      alongTargetsRef.current,
      blips,
      trackLengthM,
      (blip) => blip.alongM
    );
    const travel = along.setTargets(alongTargetsRef.current, now);
    updateTargets(
      lateralTargetsRef.current,
      blips,
      trackLengthM,
      (blip) => blip.drawLateralM
    );
    const drift = lateral.setTargets(lateralTargetsRef.current, now);

    const paint = () => {
      const count = along.getCount();
      if (alongMRef.current.length < count) {
        alongMRef.current = new Float64Array(count);
        lateralMRef.current = new Float64Array(count);
      }
      const scale = trackLengthRef.current;
      const alongValues = along.getValues();
      const lateralValues = lateral.getValues();
      for (let i = 0; i < count; i++) {
        alongMRef.current[i] = unwrapFraction(alongValues[i]) * scale;
        lateralMRef.current[i] = unwrapFraction(lateralValues[i]) * scale;
      }
      drawRef.current({
        alongM: alongMRef.current,
        lateralM: lateralMRef.current,
        count,
      });
    };

    // Every snapshot has to be painted here even when the loop below is already
    // running, because the loop only keeps going while something is still
    // moving: a snapshot that settles the field would otherwise be dropped and
    // the canvas would keep the last interpolated position. The RAF loop owns
    // everything after this.
    perfMetrics.measure('radarAnimationFrame', paint);

    let frameTime = 0;
    const measuredFrame = () => {
      const travelling = along.advance(frameTime);
      const drifting = lateral.advance(frameTime);
      const moving = travelling || drifting;
      paint();
      return moving;
    };
    const frame = (now: number) => {
      frameTime = now;
      const active = perfMetrics.measure('radarAnimationFrame', measuredFrame);
      frameRef.current =
        active || pulseActive ? requestAnimationFrame(frame) : 0;
    };

    if ((travel || drift || pulseActive) && frameRef.current === 0) {
      frameRef.current = requestAnimationFrame(frame);
    }

    return () => {
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, [blips, trackLengthM, pulseActive]);
};
