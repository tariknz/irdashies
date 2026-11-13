import { useMemo } from 'react';
import {
  useDriverCarIdx,
  usePitStopEstimateSnapshot,
} from '@irdashies/context';
import type {
  PitExitEstimateSettings,
  PitStopEstimateSnapshot,
} from '@irdashies/types';

export interface PitExitMarker {
  /** Always the player's own car, not the car the camera is on. */
  anchorCarIdx: number;
  offsetPct: number;
  nearPct: number;
  farPct: number;
  state: 'ok' | 'calibrating' | 'unreliable';
}

export const toPitExitMarker = (
  snapshot: PitStopEstimateSnapshot | undefined,
  playerCarIdx: number | undefined,
  settings: PitExitEstimateSettings | undefined
): PitExitMarker | null => {
  if (!settings?.enabled || !snapshot || playerCarIdx === undefined) {
    return null;
  }
  if (snapshot.state === 'hidden' || snapshot.offsetPct === null) return null;
  if (
    settings.showWhen === 'fuelStopNeeded' &&
    snapshot.fuelStopNeeded !== true
  ) {
    return null;
  }
  return {
    anchorCarIdx: playerCarIdx,
    offsetPct: snapshot.offsetPct,
    nearPct: snapshot.offsetNearPct ?? snapshot.offsetPct,
    farPct: snapshot.offsetFarPct ?? snapshot.offsetPct,
    state: snapshot.state,
  };
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
