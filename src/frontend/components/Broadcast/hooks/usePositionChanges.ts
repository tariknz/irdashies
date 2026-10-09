import { useState } from 'react';
import type { Standings } from '@irdashies/domain';
import { diffClassPositions } from '../broadcastRows';

interface PositionChange {
  delta: number;
  /** Bumps on every change so the highlight animation restarts. */
  seq: number;
}

/**
 * Remembers the last class position change of each car. A new session
 * reorders everyone at once, which is not an overtake, so it starts clean.
 */
export const usePositionChanges = (
  standings: readonly Standings[],
  sessionNum: number | null | undefined
) => {
  const [state, setState] = useState({
    standings,
    sessionNum,
    seq: 0,
    changes: new Map<number, PositionChange>(),
  });
  if (state.sessionNum !== sessionNum) {
    setState({ standings, sessionNum, seq: state.seq, changes: new Map() });
  } else if (state.standings !== standings) {
    const diff = diffClassPositions(state.standings, standings);
    const seq = state.seq + 1;
    const changes = diff.size ? new Map(state.changes) : state.changes;
    for (const [carIdx, delta] of diff) changes.set(carIdx, { delta, seq });
    setState({ standings, sessionNum, seq, changes });
  }
  return state.changes;
};
