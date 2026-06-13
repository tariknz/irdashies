import { useEffect, useMemo, useRef, useState } from 'react';
import { useTelemetryValues } from '@irdashies/context';

export interface RadioActiveCarIdxs {
  /** Cars whose speaker icon should be shown (currently transmitting OR within
   * the persistence window after they stopped). */
  active: number[];
  /** Cars transmitting on the radio right now this telemetry frame. */
  transmitting: number[];
}

/**
 * Tracks which car indices should show the radio/speaker icon.
 *
 * iRacing only reports a car as transmitting for the exact frames it holds the
 * push-to-talk, so the icon can flash and vanish before a driver looks up from
 * a corner. When `persistenceMs > 0`, a car stays in `active` for that long
 * after it stops transmitting, keeping the icon visible long enough to notice.
 * When `persistenceMs <= 0`, `active` equals the live `transmitting` set.
 *
 * `transmitting` always reflects the live telemetry, so callers can render the
 * lingering state (active but no longer transmitting) differently.
 */
export const useRadioActiveCarIdxs = (
  persistenceMs: number
): RadioActiveCarIdxs => {
  const radioTransmitCarIdx = useTelemetryValues<number[]>(
    'RadioTransmitCarIdx'
  );
  const lastSeenRef = useRef<Map<number, number>>(new Map());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const [persisted, setPersisted] = useState<number[]>([]);

  const transmitting = useMemo(
    () => radioTransmitCarIdx.filter((carIdx) => carIdx >= 0),
    [radioTransmitCarIdx]
  );

  useEffect(() => {
    if (persistenceMs <= 0) {
      lastSeenRef.current.clear();
      return;
    }

    const lastSeen = lastSeenRef.current;
    const now = Date.now();

    // Refresh the "last seen transmitting" timestamp for every active car.
    for (const carIdx of transmitting) {
      lastSeen.set(carIdx, now);
    }

    const recompute = () => {
      const t = Date.now();
      let soonestExpiry = Infinity;
      const active: number[] = [];
      for (const [carIdx, seenAt] of lastSeen) {
        const expiresAt = seenAt + persistenceMs;
        if (t < expiresAt) {
          active.push(carIdx);
          soonestExpiry = Math.min(soonestExpiry, expiresAt);
        } else {
          lastSeen.delete(carIdx);
        }
      }

      active.sort((a, b) => a - b);
      setPersisted((prev) =>
        prev.length === active.length && prev.every((v, i) => v === active[i])
          ? prev
          : active
      );

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Schedule a follow-up so the icon clears even when no new telemetry
      // arrives to trigger a re-render (e.g. an idle, silent grid).
      if (soonestExpiry !== Infinity) {
        timeoutRef.current = setTimeout(recompute, soonestExpiry - t + 16);
      }
    };

    recompute();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [transmitting, persistenceMs]);

  return useMemo(
    () => ({
      active: persistenceMs > 0 ? persisted : transmitting,
      transmitting,
    }),
    [persistenceMs, persisted, transmitting]
  );
};
