import { useMemo } from 'react';
import {
  useSectorTimingStore,
  useSessionStore,
  useDriverCarIdx,
  useReferenceLapStore,
  useTelemetryValueRounded,
} from '@irdashies/context';
import { calculateReferenceDelta } from '../../Standings/relativeGapHelpers';

/**
 * Returns a live delta (seconds) for the current sector vs the reference lap.
 *
 * Compares the player's elapsed time since sector entry against the reference
 * lap's interpolated elapsed time at the same track position. Positive = behind
 * the reference, negative = ahead.
 *
 * When `useGhostFile` is true, compares against the file-loaded ghost lap.
 * Otherwise compares against the player's in-session personal best only —
 * returns null until a personal best lap has been completed.
 *
 * Returns null when no reference data is available or the current sector entry
 * is invalid (reset/teleport).
 */
export const useLiveSectorDelta = (useGhostFile: boolean): number | null => {
  // 4dp matches the reference-lap interpolation step (REFERENCE_INTERVAL = 0.0025);
  // 2dp on SessionTime gives 10ms resolution which exceeds the 0.1s display.
  const lapDistPct = useTelemetryValueRounded('LapDistPct', 4) ?? 0;
  const sessionTime = useTelemetryValueRounded('SessionTime', 2) ?? 0;

  const sectorEntryTime = useSectorTimingStore((s) => s.sectorEntryTime);
  const sectorEntryValid = useSectorTimingStore((s) => s.sectorEntryValid);
  const currentSectorIdx = useSectorTimingStore((s) => s.currentSectorIdx);
  const sectors = useSectorTimingStore((s) => s.sectors);

  const playerCarIdx = useDriverCarIdx();
  const playerClassId = useSessionStore((s) => {
    const carIdx = s.session?.DriverInfo?.DriverCarIdx;
    const drivers = s.session?.DriverInfo?.Drivers;
    return drivers?.find((d) => d.CarIdx === carIdx)?.CarClassID ?? null;
  });

  // Subscribe to these so the memo re-runs when a ghost lap is loaded or the
  // session resets — the actual lap data is accessed via getState() below.
  const persistedLapsVersion = useReferenceLapStore(
    (s) => s.persistedLapsVersion
  );
  const seriesId = useReferenceLapStore((s) => s.seriesId);

  return useMemo(() => {
    if (!sectorEntryValid) return null;
    if (playerCarIdx == null || playerClassId == null) return null;

    const state = useReferenceLapStore.getState();
    const refLap = useGhostFile
      ? state.getReferenceLap(playerCarIdx, playerClassId, true)
      : state.bestLaps.get(playerCarIdx);

    if (!refLap || refLap.startTime < 0 || refLap.refPoints.size === 0)
      return null;

    const sectorStart = sectors[currentSectorIdx]?.SectorStartPct ?? 0;
    const ghostElapsed = calculateReferenceDelta(
      refLap,
      lapDistPct,
      sectorStart
    );
    const playerElapsed = sessionTime - sectorEntryTime;

    return playerElapsed - ghostElapsed;
    // persistedLapsVersion and seriesId are intentionally included as deps even
    // though they're not used directly — they trigger re-computation when ghost
    // lap data changes or the session resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lapDistPct,
    sessionTime,
    sectorEntryTime,
    sectorEntryValid,
    currentSectorIdx,
    sectors,
    playerCarIdx,
    playerClassId,
    persistedLapsVersion,
    seriesId,
    useGhostFile,
  ]);
};
