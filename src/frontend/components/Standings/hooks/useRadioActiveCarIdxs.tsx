import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useTelemetryValues } from '@irdashies/context';

/**
 * Tracks which car indices should show the radio/speaker icon.
 *
 * iRacing only reports a car as transmitting for the exact frames it holds the
 * push-to-talk, so the raw signal flickers — badly when a driver keys the radio
 * on and off rapidly. To keep the icon stable we debounce: each car heard
 * transmitting is kept active until `persistenceMs` has elapsed since its
 * *last* transmit frame. Rapid on/off toggling just keeps pushing that deadline
 * out, so the icon stays lit instead of strobing.
 *
 * When `persistenceMs <= 0` the live transmitting set is returned unchanged.
 */
export const useRadioActiveCarIdxs = (persistenceMs: number): number[] => {
  const radioTransmitCarIdx = useTelemetryValues<number[]>(
    'RadioTransmitCarIdx'
  );

  const transmitting = useMemo(
    () => radioTransmitCarIdx.filter((carIdx) => carIdx >= 0),
    [radioTransmitCarIdx]
  );

  // carIdx -> timestamp the icon should clear (last transmit frame + window).
  const expiryRef = useRef<Map<number, number>>(new Map());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  // Bumped to force a re-render when a window expires with no new telemetry.
  const [renderTick, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const expiry = expiryRef.current;

    if (persistenceMs <= 0) {
      expiry.clear();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    // (Re)stamp each heard car's clear deadline. Seeing a car again before its
    // deadline simply pushes it out — this is the debounce that keeps the icon
    // solidly lit through rapid flip-flapping.
    const now = Date.now();
    for (const carIdx of transmitting) {
      expiry.set(carIdx, now + persistenceMs);
    }

    // Schedule a re-render at the soonest deadline so the icon clears even on an
    // idle grid where no new telemetry arrives to trigger renders. Reschedules
    // itself for the next deadline since the effect won't re-run while silent.
    const scheduleNext = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const t = Date.now();
      let soonest = Infinity;
      for (const [carIdx, expiresAt] of expiry) {
        if (expiresAt <= t) expiry.delete(carIdx);
        else soonest = Math.min(soonest, expiresAt);
      }
      if (soonest !== Infinity) {
        timeoutRef.current = setTimeout(
          () => {
            forceRender();
            scheduleNext();
          },
          soonest - t + 16
        );
      }
    };
    scheduleNext();
  }, [transmitting, persistenceMs]);

  // Clear the pending timer on unmount.
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  return useMemo(() => {
    if (persistenceMs <= 0) return transmitting;

    // Currently-transmitting cars are always shown (covers the frame a car
    // first keys up, before the effect has stamped its deadline). Recently-seen
    // cars stay in until their window lapses.
    const now = Date.now();
    const active = new Set<number>(transmitting);
    for (const [carIdx, expiresAt] of expiryRef.current) {
      if (now < expiresAt) active.add(carIdx);
    }
    return [...active].sort((a, b) => a - b);
    // renderTick forces recompute when a window expires with no telemetry change.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [persistenceMs, transmitting, renderTick]);
};
