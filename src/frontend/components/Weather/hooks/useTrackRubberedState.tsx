import { useSessionStore } from '@irdashies/context';
import { useStore } from 'zustand';

export const useTrackRubberedState = () => {
  return useStore(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.find(
        (session) => session.SessionNum === 0
      )?.SessionTrackRubberState
  );
};
