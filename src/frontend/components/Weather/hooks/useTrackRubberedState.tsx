import { useSessionStore } from '@irdashies/context';
import { useStore } from 'zustand';

export const useTrackRubberedState = () => {
  return useStore(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.findLast(
        (session) => session.SessionTrackRubberState != 'carry over'
      )?.SessionTrackRubberState
  );
};
