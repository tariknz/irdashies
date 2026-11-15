import { useMemo } from 'react';
import {
  useDriverCarIdx,
  usePitStopEstimateSnapshot,
} from '@irdashies/context';
import type {
  PitExitEstimateSettings,
  PitStopEstimateSnapshot,
} from '@irdashies/types';

export interface PitExitNeighbour {
  carIdx: number;
  gapSeconds: number;
}

export interface PitExitMarker {
  /** Always the player's own car, not the car the camera is on. */
  anchorCarIdx: number;
  offsetPct: number;
  nearPct: number;
  farPct: number;
  state: 'ok' | 'calibrating' | 'unreliable';
  /** The nearest cars ahead of and behind the rejoin point. */
  ahead: PitExitNeighbour | null;
  behind: PitExitNeighbour | null;
}

const neighbour = (
  carIdx: number | null | undefined,
  gapSeconds: number | null | undefined
): PitExitNeighbour | null =>
  carIdx === null || carIdx === undefined || gapSeconds == null
    ? null
    : { carIdx, gapSeconds };

export const toPitExitMarker = (
  snapshot: PitStopEstimateSnapshot | undefined,
  playerCarIdx: number | undefined,
  settings: PitExitEstimateSettings | undefined
): PitExitMarker | null => {
  if (!settings?.enabled || !snapshot || playerCarIdx === undefined) {
    return null;
  }
  if (snapshot.state === 'hidden' || snapshot.offsetPct === null) return null;
  // Refuelling clears "fuel stop needed", but the stop still has to finish.
  if (
    settings.showWhen === 'fuelStopNeeded' &&
    snapshot.fuelStopNeeded !== true &&
    !snapshot.inStop
  ) {
    return null;
  }
  return {
    anchorCarIdx: playerCarIdx,
    offsetPct: snapshot.offsetPct,
    nearPct: snapshot.offsetNearPct ?? snapshot.offsetPct,
    farPct: snapshot.offsetFarPct ?? snapshot.offsetPct,
    state: snapshot.state,
    ahead: neighbour(snapshot.aheadCarIdx, snapshot.aheadGapSeconds),
    behind: neighbour(snapshot.behindCarIdx, snapshot.behindGapSeconds),
  };
};

/** "#12 1.4s ahead" then "#7 2.0s behind", for the cars that are known. */
export const pitExitTrafficLines = (
  marker: Pick<PitExitMarker, 'ahead' | 'behind'>,
  carNumber: (carIdx: number) => string | undefined
): string[] => {
  const lines: string[] = [];
  const line = (car: PitExitNeighbour | null, side: 'ahead' | 'behind') => {
    if (!car) return;
    const number = carNumber(car.carIdx);
    if (number === undefined) return;
    lines.push(`#${number} ${car.gapSeconds.toFixed(1)}s ${side}`);
  };
  line(marker.ahead, 'ahead');
  line(marker.behind, 'behind');
  return lines;
};

export const usePitExitMarker = (
  settings: PitExitEstimateSettings | undefined
): PitExitMarker | null => {
  const enabled = settings?.enabled ?? false;
  const snapshot = usePitStopEstimateSnapshot(enabled);
  const playerCarIdx = useDriverCarIdx();
  const showWhen = settings?.showWhen;
  return useMemo(
    () =>
      toPitExitMarker(
        snapshot,
        playerCarIdx,
        enabled ? { enabled, showWhen: showWhen ?? 'always' } : undefined
      ),
    [snapshot, playerCarIdx, enabled, showWhen]
  );
};
