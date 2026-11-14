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
    onSubscribe?: (sender: Electron.WebContents, key: Key) => void,
    onUnsubscribe?: (sender: Electron.WebContents, key: Key) => void
  ) =>
    defineRendererSubscriptionBridge<Key>({
      name: 'legacy-test',
      isValidKey: (value): value is Key =>
        value === 'telemetry' || value === 'sessionData',
      onSubscribe,
      onUnsubscribe,
    });

  const pageListeners = (sender: FakeSender) =>
    sender.listenerCount('destroyed') +
    sender.listenerCount('did-start-navigation') +
    sender.listenerCount('did-start-loading');

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

  it.each([
    ['destroyed', (sender: FakeSender) => sender.emit('destroyed')],
    [
      'a main-frame navigation',
      (sender: FakeSender) =>
        sender.emit('did-start-navigation', {}, 'x', false, true),
    ],
  ])('cleans renderer state on %s', (_name, leave) => {
    const bridge = setup();
    const sender = new FakeSender(9);
    handlers.get('legacy-test:subscribe')?.({ sender }, 'sessionData');

    leave(sender);

    expect(bridge.registry.hasAny('sessionData')).toBe(false);
    expect(pageListeners(sender)).toBe(0);
  });

  it('keeps subscriptions while an iframe loads and through same-document navigations', () => {
    const bridge = setup();
    const sender = new FakeSender(10);
    handlers.get('legacy-test:subscribe')?.({ sender }, 'sessionData');

    // Chromium fires did-start-loading for iframe loads as well.
    sender.emit('did-start-loading');
    sender.emit('did-start-navigation', {}, 'preview.html', false, false);
    sender.emit('did-start-navigation', {}, '#/settings/map', true, true);

    expect(bridge.registry.has(10, 'sessionData')).toBe(true);
  });

  it('stops watching a renderer once its last key is unsubscribed, and reports each unsubscribe', () => {
    const onUnsubscribe = vi.fn();
    const bridge = setup(undefined, onUnsubscribe);
    const sender = new FakeSender(12);
    const subscribe = handlers.get('legacy-test:subscribe');
    const unsubscribe = handlers.get('legacy-test:unsubscribe');
    subscribe?.({ sender }, 'sessionData');
    subscribe?.({ sender }, 'telemetry');

    expect(() => unsubscribe?.({ sender }, 'invalid')).toThrow(
      'Invalid legacy-test unsubscribe'
    );
    unsubscribe?.({ sender }, 'sessionData');
    expect(pageListeners(sender)).toBeGreaterThan(0);
    unsubscribe?.({ sender }, 'telemetry');

    expect(pageListeners(sender)).toBe(0);
    expect(bridge.registry.hasAny('telemetry')).toBe(false);
    expect(onUnsubscribe.mock.calls).toEqual([
      [sender, 'sessionData'],
      [sender, 'telemetry'],
    ]);

    // Watched again on the next subscribe.
    subscribe?.({ sender }, 'telemetry');
    sender.emit('destroyed');
    expect(bridge.registry.hasAny('telemetry')).toBe(false);
  });

  it('unregisters handlers and clears state when disposed', () => {
    const bridge = setup();
    const sender = new FakeSender(11);
    handlers.get('legacy-test:subscribe')?.({ sender }, 'telemetry');

    bridge.dispose();

    expect(removeHandler).toHaveBeenCalledWith('legacy-test:subscribe');
    expect(removeHandler).toHaveBeenCalledWith('legacy-test:unsubscribe');
    expect(bridge.registry.hasAny('telemetry')).toBe(false);
    expect(pageListeners(sender)).toBe(0);
  });
});
