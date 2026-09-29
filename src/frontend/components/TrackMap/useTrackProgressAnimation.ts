import { useLayoutEffect, useRef } from 'react';
import { perfMetrics } from '@irdashies/utils/perfMetrics';
import {
  PROGRESS_INTERVAL_MS,
  progressToFlatX,
  ProgressInterpolator,
  type DrawProgress,
  type ProgressSource,
} from '@irdashies/domain/progressInterpolator';

export const TRACK_POSITION_INTERVAL_MS = PROGRESS_INTERVAL_MS;
export { progressToFlatX, ProgressInterpolator };
export type { DrawProgress };

export const useTrackProgressAnimation = (
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
