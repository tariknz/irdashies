import { useMemo, useSyncExternalStore } from 'react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';
import { ChannelSnapshotStore } from './ChannelSnapshotStore';

export const useChannelSnapshot = <K extends ChannelName>(
  channel: K,
  rateHz?: number,
  bridge?: ChannelBridge
): ChannelPayloads[K] | undefined => {
  const store = useMemo(
    () => new ChannelSnapshotStore(channel, rateHz, bridge),
    [bridge, channel, rateHz]
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
};
