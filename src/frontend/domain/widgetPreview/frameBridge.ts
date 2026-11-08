import {
  channelRegistry,
  type ChannelBridge,
  type ChannelName,
  type ChannelPayloads,
} from '@irdashies/types';
import type { WidgetPreviewRequest } from '@irdashies/types';

interface Consumer {
  callback: (payload: never) => void;
  rate?: number;
}

/** Lives only inside the iframe, including its snapshot cache and listeners. */
export function createPreviewFrameBridge(
  send: (request: WidgetPreviewRequest) => void
) {
  const consumers = new Map<ChannelName, Set<Consumer>>();
  const snapshots = new Map<ChannelName, ChannelPayloads[ChannelName]>();
  const sync = (channel: ChannelName) => {
    const listeners = consumers.get(channel);
    if (!listeners?.size) {
      send({ type: 'preview:unsubscribe', channel });
      return;
    }
    const definition = channelRegistry[channel];
    const rates = [...listeners]
      .map(
        (consumer) =>
          consumer.rate ??
          (definition.kind === 'snapshot'
            ? definition.defaultRateHz
            : undefined)
      )
      .filter((rate): rate is number => rate !== undefined);
    send({
      type: 'preview:subscribe',
      channel,
      rate: rates.length ? Math.max(...rates) : undefined,
    });
  };
  const bridge: ChannelBridge = {
    subscribe: (channel, callback, rate) => {
      let listeners = consumers.get(channel);
      if (!listeners) {
        listeners = new Set();
        consumers.set(channel, listeners);
      }
      const consumer: Consumer = {
        callback: callback as (payload: never) => void,
        rate,
      };
      listeners.add(consumer);
      sync(channel);
      const cached = snapshots.get(channel);
      if (cached !== undefined)
        callback(cached as ChannelPayloads[typeof channel]);
      return () => {
        listeners.delete(consumer);
        if (!listeners.size) consumers.delete(channel);
        sync(channel);
      };
    },
  };
  return {
    bridge,
    receive: <K extends ChannelName>(
      channel: K,
      payload: ChannelPayloads[K]
    ) => {
      if (channelRegistry[channel].kind === 'snapshot')
        snapshots.set(channel, payload);
      for (const consumer of consumers.get(channel) ?? [])
        consumer.callback(payload as never);
    },
  };
}
