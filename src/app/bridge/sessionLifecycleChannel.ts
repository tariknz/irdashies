import type { SessionLifecycle } from '../sessionLifecycle';
import type { ChannelBus } from './channelBridge';

export const connectSessionLifecycleChannel = (
  lifecycle: SessionLifecycle,
  bus: ChannelBus
): (() => void) => {
  const unsubscribe = [
    lifecycle.onEnter(({ replay }) =>
      bus.publish('session.lifecycle', { type: 'enter', replay })
    ),
    lifecycle.onSessionNumChange(() =>
      bus.publish('session.lifecycle', { type: 'sessionNumChange' })
    ),
    lifecycle.onDisconnect(() =>
      bus.publish('session.lifecycle', { type: 'disconnect' })
    ),
  ];
  return () => unsubscribe.forEach((remove) => remove());
};
