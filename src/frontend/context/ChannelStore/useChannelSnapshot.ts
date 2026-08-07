import { useMemo, useSyncExternalStore } from 'react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';
import { ChannelSnapshotStore } from './ChannelSnapshotStore';
import { useWidgetChannelRate } from '../../widgetRuntime';

export const useChannelSnapshot = <K extends ChannelName>(
  channel: K,
  rateHz?: number,
  bridge?: ChannelBridge
): ChannelPayloads[K] | undefined => {
  const configuredRateHz = useWidgetChannelRate(channel);
  const effectiveRateHz = rateHz ?? configuredRateHz;
  const store = useMemo(
    () => new ChannelSnapshotStore(channel, effectiveRateHz, bridge),
    [bridge, channel, effectiveRateHz]
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
};
