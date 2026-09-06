import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(
  () => new Map<string, (event: unknown, key: unknown) => void>()
);
const removeHandler = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn() },
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: unknown, key: unknown) => void
    ) => handlers.set(channel, handler),
    removeHandler,
  },
}));

import { defineRendererSubscriptionBridge } from './defineBridge';

class FakeSender extends EventEmitter {
  constructor(readonly id: number) {
    super();
  }
}

describe('defineRendererSubscriptionBridge', () => {
  beforeEach(() => {
    handlers.clear();
    removeHandler.mockClear();
  });

  type Key = 'telemetry' | 'sessionData';

  const setup = (
    onSubscribe?: (sender: Electron.WebContents, key: Key) => void
  ) =>
    defineRendererSubscriptionBridge<Key>({
      name: 'legacy-test',
      isValidKey: (value): value is Key =>
        value === 'telemetry' || value === 'sessionData',
      onSubscribe,
    });

  it('validates keys and tracks subscriptions by sender identity', () => {
    const bridge = setup();
    const sender = new FakeSender(7);
    const subscribe = handlers.get('legacy-test:subscribe');

    expect(() => subscribe?.({ sender }, 'invalid')).toThrow(
      'Invalid legacy-test subscription'
    );
    subscribe?.({ sender }, 'telemetry');

    expect(bridge.registry.has(7, 'telemetry')).toBe(true);
    expect(bridge.registry.hasAny('telemetry')).toBe(true);
  });

  it('calls onSubscribe with the sender and key once registered', () => {
    const onSubscribe = vi.fn((sender: Electron.WebContents, key: Key) =>
      bridge.registry.has(sender.id, key)
    );
    const bridge = setup(onSubscribe);
    const sender = new FakeSender(13);
    const subscribe = handlers.get('legacy-test:subscribe');

    expect(() => subscribe?.({ sender }, 'invalid')).toThrow();
    expect(onSubscribe).not.toHaveBeenCalled();

    subscribe?.({ sender }, 'sessionData');

    expect(onSubscribe).toHaveBeenCalledWith(sender, 'sessionData');
    // True means the registry already held the subscription when called.
    expect(onSubscribe).toHaveReturnedWith(true);
  });

  it.each(['did-start-loading', 'destroyed'])(
    'cleans renderer state on %s',
    (eventName) => {
      const bridge = setup();
      const sender = new FakeSender(9);
      handlers.get('legacy-test:subscribe')?.({ sender }, 'sessionData');

      sender.emit(eventName);

      expect(bridge.registry.hasAny('sessionData')).toBe(false);
    }
  );

  it('unregisters handlers and clears state when disposed', () => {
    const bridge = setup();
    const sender = new FakeSender(11);
    handlers.get('legacy-test:subscribe')?.({ sender }, 'telemetry');

    bridge.dispose();

    expect(removeHandler).toHaveBeenCalledWith('legacy-test:subscribe');
    expect(removeHandler).toHaveBeenCalledWith('legacy-test:unsubscribe');
    expect(bridge.registry.hasAny('telemetry')).toBe(false);
  });
});
