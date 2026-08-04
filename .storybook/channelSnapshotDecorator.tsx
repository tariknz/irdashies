import type { Decorator } from '@storybook/react-vite';
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
    window.channelBridge = bridge;
    return <Story />;
  };
  return DecoratorComponent;
};
