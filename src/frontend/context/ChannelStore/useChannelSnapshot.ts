import { useMemo, useSyncExternalStore } from 'react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';
import {
  getChannelSnapshotStore,
  type ChannelEquality,
  type ChannelSelector,
} from './ChannelSnapshotStore';
import { useWidgetChannelRate } from '../../widgetRuntime';

export interface ChannelSelectorOptions<Selected> {
  rateHz?: number;
  bridge?: ChannelBridge;
  enabled?: boolean;
  equality?: ChannelEquality<Selected>;
}

export const useChannelSelector = <K extends ChannelName, Selected>(
  channel: K,
  selector: ChannelSelector<K, Selected>,
  options: ChannelSelectorOptions<Selected> = {}
): Selected | undefined => {
  const configuredRateHz = useWidgetChannelRate(channel);
  const effectiveRateHz = options.rateHz ?? configuredRateHz;
  const effectiveBridge = options.bridge ?? window.channelBridge;
  const enabled = options.enabled ?? true;
  const equality = options.equality ?? Object.is;
  const store = useMemo(
    () => getChannelSnapshotStore(channel, effectiveBridge),
    [channel, effectiveBridge]
  );
  const selection = useMemo(
    () => store.createSelection(selector, equality, effectiveRateHz, enabled),
    // Selector/equality references are updated below without replacing the
    // subscription. Inline selectors therefore do not churn bridge demand.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [store, effectiveRateHz, enabled]
  );
  selection.updateSelector(selector, equality);
  return useSyncExternalStore(selection.subscribe, selection.getSnapshot);
};

const selectSnapshot = <Snapshot>(snapshot: Snapshot): Snapshot => snapshot;

export const useChannelSnapshot = <K extends ChannelName>(
  channel: K,
  rateHz?: number,
  bridge?: ChannelBridge,
  enabled = true
): ChannelPayloads[K] | undefined =>
  useChannelSelector(channel, selectSnapshot, {
    rateHz,
    bridge,
    enabled,
  });
