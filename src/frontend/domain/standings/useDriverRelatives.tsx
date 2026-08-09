import { useCallback, useMemo } from 'react';
import {
  useSessionStore,
  useFocusCarIdx,
  useRelativeGapsSnapshot,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import { Standings } from './createStandings';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const drivers = useDriverStandings();
  const snapshot = useRelativeGapsSnapshot();
  const rendererFocusCarIdx = useFocusCarIdx();
  // Keep ordering and deltas on the same processor tick during camera changes.
  const focusCarIdx = snapshot?.focusCarIdx ?? rendererFocusCarIdx;
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  const calculateRelativePct = useCallback(
    (opponentIdx: number): number => {
      const relativePct = snapshot?.relativePcts[opponentIdx];
      return relativePct ?? NaN;
    },
    [snapshot?.relativePcts]
  );

  const calculateDelta = useCallback(
    (opponentCarIdx: number) => {
      const delta = snapshot?.deltas[opponentCarIdx];
      return typeof delta === 'number' && Number.isFinite(delta)
        ? delta
        : undefined;
    },
    [snapshot?.deltas]
  );

  const isValidDriver = useCallback(
    (driver: Standings) => {
      // Must be a real car (idx > -1)
      if (driver.carIdx <= -1) return false;

      // Must not be the pace car
      if (driver.carIdx === paceCarIdx) return false;

      // Must be on track OR be the player (we always track the player)
      return driver.onTrack || driver.carIdx === focusCarIdx;
    },
    [focusCarIdx, paceCarIdx]
  );

  const standings = useMemo(() => {
    // A. Filter & Map (Calculate Relative Pct immutably)
    const processed = [] as Standings[];
    for (const d of drivers) {
      if (isValidDriver(d)) {
        const relativePct = calculateRelativePct(d.carIdx);

        if (!isNaN(relativePct)) {
          processed.push({
            ...d,
            relativePct,
          });
        }
      }
    }

    // B. Sort (Descending)
    processed.sort((a, b) => b.relativePct - a.relativePct);

    // C. Slice Window
    const playerIdx = processed.findIndex((d) => d.carIdx === focusCarIdx);
    if (playerIdx === -1) return [];

    const start = Math.max(0, playerIdx - buffer);
    const end = Math.min(processed.length, playerIdx + 1 + buffer);

    const visibleDrivers = processed.slice(start, end);

    // D. Final Map (Attach Delta)
    return visibleDrivers.map((d) => ({
      ...d,
      delta: calculateDelta(d.carIdx),
    }));
  }, [
    buffer,
    drivers,
    isValidDriver,
    calculateRelativePct,
    focusCarIdx,
    calculateDelta,
  ]);

  return standings;
};
