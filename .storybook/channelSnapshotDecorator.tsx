import type { Decorator } from '@storybook/react-vite';
import { useEffect, useRef } from 'react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';

type ChannelSnapshots = Partial<ChannelPayloads>;

export const ChannelSnapshotDecorator = (
  snapshots: ChannelSnapshots
): Decorator => {
  const bridge: ChannelBridge = {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void
    ) => {
      const snapshot = snapshots[channel];
      if (snapshot !== undefined) callback(snapshot as ChannelPayloads[K]);
      return () => undefined;
    },
  };

  const DecoratorComponent: Decorator = (Story) => {
    const previousBridge = useRef(window.channelBridge);
    window.channelBridge = bridge;
    useEffect(
      () => () => {
        if (previousBridge.current === undefined) {
          Reflect.deleteProperty(window, 'channelBridge');
        } else {
          window.channelBridge = previousBridge.current;
        }
      },
      []
    );
    return <Story />;
  };
  return DecoratorComponent;
};
