import { useEffect } from 'react';
import { create } from 'zustand';
import type { RacePlanBridge, RacePlanState } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

/**
 * Holds the race plan bridge state: config, fetch status and the last good
 * planning. Nothing here is session-derived, so it is not reset on
 * disconnect; the planning outlives any one session.
 */
interface RacePlanStore {
  state: RacePlanState | null;
  setState: (state: RacePlanState) => void;
}

export const useRacePlanStore = create<RacePlanStore>((set) => ({
  state: null,
  setState: (state) => set({ state }),
}));

let connections = 0;
let disconnect: (() => void) | null = null;

/** Starts mirroring the bridge into the store. Reference-counted. */
export function connectRacePlanBridge(
  bridge: RacePlanBridge | undefined = window.racePlanBridge
): () => void {
  if (!bridge) return () => undefined;
  connections += 1;
  if (connections === 1) {
    const { setState } = useRacePlanStore.getState();
    let active = true;
    let pushed = false;
    const unsubscribe = bridge.onStateChanged((state) => {
      pushed = true;
      if (active) setState(state);
    });
    bridge
      .getState()
      .then((state) => {
        // A pushed state can beat the reply; it is never older than it.
        if (active && !pushed) setState(state);
      })
      .catch((err) => logger.error('[RacePlan] Failed to load state', err));
    disconnect = () => {
      active = false;
      unsubscribe();
    };
  }
  return () => {
    connections -= 1;
    if (connections === 0) {
      disconnect?.();
      disconnect = null;
    }
  };
}

/** The race plan state, or null until the first reply from the bridge. */
export function useRacePlanState(
  bridge: RacePlanBridge | undefined = window.racePlanBridge
): RacePlanState | null {
  useEffect(() => connectRacePlanBridge(bridge), [bridge]);
  return useRacePlanStore((s) => s.state);
}
