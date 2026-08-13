import { useMemo } from 'react';
import {
  trackStateSelectors,
  useDriverCarIdx,
  useReferenceLapStore,
  useTrackStateSelector,
} from '@irdashies/context';
import { speedFromMs } from '@irdashies/utils/units';
import {
  hasCompleteSpeedTrace,
  interpolateSpeedAtPoint,
} from '../referenceSpeed';

/**
 * Live speed delta in KM/H against the player's own session-best clean lap at
 * the current point on track. Positive = faster than the reference.
 *
 * Returns null whenever there is nothing trustworthy to show — no clean lap set
 * yet, a reference lap without a complete speed trace, or a point on track the
 * reference never recorded. The widget shows a placeholder in that case rather
 * than a stale or invented number.
 */
export const useDeltaSpeed = (): number | null => {
  // Full precision on speed: it drives the bar, and it is the quantity being
  // compared rather than a display value. Do not round this one.
  const speedMs = useTrackStateSelector(trackStateSelectors.speed);
  // Full precision through, but only re-rendering once the position moves by
  // 1e-4 — ~2m even on a 20km track, well inside the reference lap's 10m
  // buckets. Rounding the *value* instead would quantise the interpolation
  // input and visibly step the delta; this mirrors useTelemetryValueRounded,
  // which likewise rounds only for the comparison.
  const lapDistPct = useTrackStateSelector(trackStateSelectors.lapDistPct, {
    equality: (a, b) => Math.round(a * 10000) === Math.round(b * 10000),
  });

  const playerCarIdx = useDriverCarIdx();
  // Subscribed rather than read inside the memo: the store swaps in fresh maps
  // on every reference-laps snapshot, and selecting the lap itself means a
  // re-render only when this car's best actually changes.
  const referenceLap = useReferenceLapStore((s) =>
    playerCarIdx == null ? null : s.getSessionBestLap(playerCarIdx)
  );

  return useMemo(() => {
    if (speedMs == null || lapDistPct == null) return null;
    if (lapDistPct < 0) return null;

    if (!referenceLap || referenceLap.finishTime < 0) return null;
    if (!hasCompleteSpeedTrace(referenceLap)) return null;

    const referenceKph = interpolateSpeedAtPoint(referenceLap, lapDistPct);
    if (referenceKph === null) return null;

    return speedFromMs(speedMs, 'km/h') - referenceKph;
  }, [speedMs, lapDistPct, referenceLap]);
};
