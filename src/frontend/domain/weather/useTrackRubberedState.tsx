import { useSessionStore } from '@irdashies/context';
import { useStore } from 'zustand';

/**
 * An empty state is unknown, not a state: LMU has no rubber model to report,
 * and its session carries '' here, which would otherwise render as a blank
 * cell instead of "N/A".
 */
export const useTrackRubberedState = () => {
  return useStore(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.findLast(
        (session) => session.SessionTrackRubberState !== 'carry over'
      )?.SessionTrackRubberState || undefined
  );
};
