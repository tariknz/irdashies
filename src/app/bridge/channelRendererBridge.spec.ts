import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => void>()
);
const invoke = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('electron', () => ({
  ipcRenderer: {
    on: (channel: string, listener: (...args: unknown[]) => void) =>
      listeners.set(channel, listener),
    invoke,
  },
  contextBridge: { exposeInMainWorld: vi.fn() },
  BrowserWindow: {},
  ipcMain: {},
}));

import {
  CHANNEL_DELIVERY,
  CHANNEL_SUBSCRIBE,
  CHANNEL_UNSUBSCRIBE,
} from './channelBridge';
import { createChannelRendererBridge } from './channelRendererBridge';

interface TestSnapshotBridge {
  subscribe(
    channel: 'fuel.projection',
    callback: (payload: number) => void,
    requestedRateHz?: number
  ): () => void;
}

describe('channel renderer bridge', () => {
  beforeEach(() => {
    listeners.clear();
    invoke.mockClear();
  });

  it('reference counts consumers and subscribes at their highest rate', () => {
    const bridge =
      createChannelRendererBridge() as unknown as TestSnapshotBridge;
    const callbackA = vi.fn();
    const callbackB = vi.fn();

    const unsubscribeA = bridge.subscribe('fuel.projection', callbackA, 5);
    const unsubscribeB = bridge.subscribe('fuel.projection', callbackB, 20);

    expect(invoke).toHaveBeenNthCalledWith(
      1,
      CHANNEL_SUBSCRIBE,
      'fuel.projection',
      5
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      CHANNEL_SUBSCRIBE,
      'fuel.projection',
      20
    );

    listeners.get(CHANNEL_DELIVERY)?.({}, 'fuel.projection', 12);
    expect(callbackA).toHaveBeenCalledOnce();
    expect(callbackB).toHaveBeenCalledOnce();

    unsubscribeB();
    expect(invoke).toHaveBeenLastCalledWith(
      CHANNEL_SUBSCRIBE,
      'fuel.projection',
      5
    );
    unsubscribeA();
    expect(invoke).toHaveBeenLastCalledWith(
      CHANNEL_UNSUBSCRIBE,
      'fuel.projection'
    );
  });

  it('treats an omitted rate as the channel default and downgrades when it leaves', () => {
    const bridge =
      createChannelRendererBridge() as unknown as TestSnapshotBridge;

    const unsubscribeDefault = bridge.subscribe('fuel.projection', vi.fn());
    const unsubscribeSlow = bridge.subscribe('fuel.projection', vi.fn(), 2);

    expect(invoke).toHaveBeenNthCalledWith(
      1,
      CHANNEL_SUBSCRIBE,
      'fuel.projection',
      5
    );
    expect(invoke).toHaveBeenCalledOnce();

    unsubscribeDefault();
    expect(invoke).toHaveBeenLastCalledWith(
      CHANNEL_SUBSCRIBE,
      'fuel.projection',
      2
    );

    unsubscribeSlow();
    expect(invoke).toHaveBeenLastCalledWith(
      CHANNEL_UNSUBSCRIBE,
      'fuel.projection'
    );
  });
});
