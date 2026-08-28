import type { Decorator } from '@storybook/react-vite';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';
import { buildCaptureSnapshots } from './captureSnapshots';

/**
 * Serves channel data generated from the same capture the story loads.
 *
 * Unlike ChannelSnapshotDecorator, which takes snapshots already in hand, this
 * one resolves them asynchronously because a capture is a dynamic import.
 * Channels are push based, so a subscriber simply receives its payload when the
 * capture has finished loading.
 */
const bridgeFor = (path?: string): ChannelBridge => {
  const snapshots = buildCaptureSnapshots(path);
  return {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void
    ) => {
      let subscribed = true;
      void snapshots.then((resolved) => {
        if (!subscribed) return;
        const snapshot = resolved[channel];
        if (snapshot !== undefined) callback(snapshot as ChannelPayloads[K]);
      });
      return () => {
        subscribed = false;
      };
    },
  };
};

/**
 * Component form, for a story whose capture is chosen at runtime. A decorator
 * is built once, so it cannot follow a path held in React state.
 */
export const CaptureChannels = ({
  path,
  children,
}: {
  path?: string;
  children: ReactNode;
}) => {
  const previousBridge = useRef(window.channelBridge);
  window.channelBridge = useMemo(() => bridgeFor(path), [path]);
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
  return <>{children}</>;
};

export const CaptureChannelDecorator = (path?: string): Decorator => {
  const bridge = bridgeFor(path);

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
