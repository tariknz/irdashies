import { ipcRenderer } from 'electron';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';
import { defineBridge } from './defineBridge';
import {
  CHANNEL_DELIVERY,
  CHANNEL_SUBSCRIBE,
  CHANNEL_UNSUBSCRIBE,
} from './channelBridge';

interface LocalConsumer {
  callback: (payload: never) => void;
  rate?: number;
}

interface LocalSubscription {
  consumers: Set<LocalConsumer>;
  isSubscribed: boolean;
  subscribedRate?: number;
}

export const createChannelRendererBridge = (): ChannelBridge => {
  const subscriptions = new Map<ChannelName, LocalSubscription>();

  ipcRenderer.on(
    CHANNEL_DELIVERY,
    (_event, channel: ChannelName, payload: unknown) => {
      const subscription = subscriptions.get(channel);
      if (!subscription) return;
      for (const consumer of subscription.consumers) {
        consumer.callback(payload as never);
      }
    }
  );

  const sync = (channel: ChannelName, subscription: LocalSubscription) => {
    const rates = [...subscription.consumers]
      .map((consumer) => consumer.rate)
      .filter((rate): rate is number => rate !== undefined);
    const requestedRate = rates.length > 0 ? Math.max(...rates) : undefined;
    if (
      subscription.isSubscribed &&
      subscription.subscribedRate === requestedRate
    ) {
      return;
    }
    subscription.isSubscribed = true;
    subscription.subscribedRate = requestedRate;
    void ipcRenderer.invoke(CHANNEL_SUBSCRIBE, channel, requestedRate);
  };

  return {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void,
      requestedRateHz?: number
    ) => {
      let subscription = subscriptions.get(channel);
      if (!subscription) {
        subscription = { consumers: new Set(), isSubscribed: false };
        subscriptions.set(channel, subscription);
      }
      const consumer: LocalConsumer = {
        callback: callback as (payload: never) => void,
        rate: requestedRateHz,
      };
      subscription.consumers.add(consumer);
      sync(channel, subscription);

      let active = true;
      return () => {
        if (!active) return;
        active = false;
        subscription?.consumers.delete(consumer);
        if (!subscription || subscription.consumers.size === 0) {
          subscriptions.delete(channel);
          void ipcRenderer.invoke(CHANNEL_UNSUBSCRIBE, channel);
          return;
        }
        sync(channel, subscription);
      };
    },
  };
};

export const exposeChannelBridge = (): ChannelBridge =>
  defineBridge<ChannelBridge>('channelBridge', createChannelRendererBridge());
