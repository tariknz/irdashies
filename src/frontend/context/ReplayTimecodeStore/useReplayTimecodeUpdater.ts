import { useEffect } from 'react';
import { useChannelSnapshot } from '../ChannelStore/useChannelSnapshot';
import { useReplayTimecodeStore } from './ReplayTimecodeStore';

/** Copies the `replay.timecode` channel into the store. Mount once per window. */
export const useReplayTimecodeUpdater = () => {
  const snapshot = useChannelSnapshot('replay.timecode');

  useEffect(() => {
    if (snapshot) useReplayTimecodeStore.getState().setSnapshot(snapshot);
  }, [snapshot]);
};
