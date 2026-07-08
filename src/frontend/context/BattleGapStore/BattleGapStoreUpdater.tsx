import { useEffect, useRef } from 'react';
import { useBattleGapStore } from './BattleGapStore';
import { useFocusCarIdx } from '../shared/useFocusCarIdx';
import { useTelemetryValues } from '../TelemetryStore/TelemetryStore';

interface BattleGapStoreUpdaterProps {
  /** Live gap to the car immediately ahead of the player (negative = ahead) */
  liveGapAhead: number | null;
  /** Live gap to the car immediately behind the player (positive = behind) */
  liveGapBehind: number | null;
}

/**
 * Watches for the player completing a new lap and snapshots the live gaps at
 * that moment, creating a per-lap Gap / Prev / Delta comparison.
 */
export const useBattleGapStoreUpdater = ({
  liveGapAhead,
  liveGapBehind,
}: BattleGapStoreUpdaterProps) => {
  const focusCarIdx = useFocusCarIdx();
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const snapshot = useBattleGapStore((s) => s.snapshot);
  const reset = useBattleGapStore((s) => s.reset);

  const prevLapRef = useRef<number>(-1);

  // Reset store when focus car changes (e.g. new session or spectator mode switch)
  useEffect(() => {
    reset();
    prevLapRef.current = -1;
  }, [focusCarIdx, reset]);

  useEffect(() => {
    if (focusCarIdx === undefined) return;

    const currentLap = carIdxLap?.[focusCarIdx] ?? -1;
    if (currentLap <= 0) return;

    if (currentLap !== prevLapRef.current) {
      prevLapRef.current = currentLap;
      snapshot(liveGapAhead, liveGapBehind, currentLap);
    }
  }, [carIdxLap, focusCarIdx, liveGapAhead, liveGapBehind, snapshot]);
};
