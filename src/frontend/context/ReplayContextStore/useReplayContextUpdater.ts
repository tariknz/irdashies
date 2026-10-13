import { useEffect } from 'react';
import { useChannelSnapshot } from '../ChannelStore/useChannelSnapshot';
import { useReplayContextStore } from './ReplayContextStore';

/** Copies the `replay.context` channel into the store. Mount once per window. */
export const useReplayContextUpdater = () => {
  const snapshot = useChannelSnapshot('replay.context');

  useEffect(() => {
    if (snapshot) useReplayContextStore.getState().setSnapshot(snapshot);
  }, [snapshot]);
};
