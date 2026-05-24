import { useMemo } from 'react';
import {
  useSectorTimingStore,
  useSessionStore,
  useReferenceLapStore,
  useTelemetryValueRounded,
  useDriverCarIdx,
} from '@irdashies/context';
import { calculateReferenceDelta } from '../../Standings/relativeGapHelpers';

/**
 * Returns a live delta (seconds) for the current sector vs the reference lap.
 *
 * Compares the player's elapsed time since sector entry against the reference
 * lap's interpolated elapsed time at the same track position. Positive = behind
 * the reference, negative = ahead.
 *
 * Automatically selects the best available reference lap: prefers the player's
 * in-session personal best, falling back to the class-best (ghost) lap.
 *
 * Returns null when no reference data is available or the current sector entry
 * is invalid (reset/teleport).
 */
export const useLiveSectorDelta = (): number | null => {
  // 4dp matches the reference-lap interpolation step (REFERENCE_INTERVAL = 0.0025);
  // 2dp on SessionTime gives 10ms resolution which exceeds the 0.1s display.
  const lapDistPct = useTelemetryValueRounded('LapDistPct', 4) ?? 0;
  const sessionTime = useTelemetryValueRounded('SessionTime', 2) ?? 0;

  const sectorEntryTime = useSectorTimingStore((s) => s.sectorEntryTime);
  const sectorEntryValid = useSectorTimingStore((s) => s.sectorEntryValid);
  const currentSectorIdx = useSectorTimingStore((s) => s.currentSectorIdx);
  const sectors = useSectorTimingStore((s) => s.sectors);
  const getReferenceLap = useReferenceLapStore((s) => s.getReferenceLap);

  const playerCarIdx = useDriverCarIdx();
  const playerClassId = useSessionStore((s) => {
    const carIdx = s.session?.DriverInfo?.DriverCarIdx;
    const drivers = s.session?.DriverInfo?.Drivers;
    return drivers?.find((d) => d.CarIdx === carIdx)?.CarClassID ?? null;
  });

  return useMemo(() => {
    if (!sectorEntryValid) return null;
    if (playerCarIdx == null || playerClassId == null) return null;

    const refLap = getReferenceLap(playerCarIdx, playerClassId, false);

    if (!refLap || refLap.finishTime < 0) return null;

    const sectorStart = sectors[currentSectorIdx]?.SectorStartPct ?? 0;
    const ghostElapsed = calculateReferenceDelta(
      refLap,
      lapDistPct,
      sectorStart
    );
    const playerElapsed = sessionTime - sectorEntryTime;

    return playerElapsed - ghostElapsed;
  }, [
    sectorEntryValid,
    playerCarIdx,
    playerClassId,
    getReferenceLap,
    sectors,
    currentSectorIdx,
    lapDistPct,
    sessionTime,
    sectorEntryTime,
  ]);
};
