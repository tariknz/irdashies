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

  const setup = () =>
    defineRendererSubscriptionBridge<'telemetry' | 'sessionData'>({
      name: 'legacy-test',
      isValidKey: (value): value is 'telemetry' | 'sessionData' =>
        value === 'telemetry' || value === 'sessionData',
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
