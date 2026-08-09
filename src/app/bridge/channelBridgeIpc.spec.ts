import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (
  event: { sender: FakeSender },
  channel: unknown,
  rate?: unknown
) => void;

const handlers = vi.hoisted(() => new Map<string, Handler>());
const windowListeners = vi.hoisted(() => new Map<string, () => void>());
const windowState = vi.hoisted(() => ({ visible: true }));

class FakeSender {
  readonly id = 42;
  private destroyedListener?: () => void;
  send = vi.fn();
  isDestroyed = () => false;
  once = (_event: string, listener: () => void) => {
    this.destroyedListener = listener;
  };
  destroy(): void {
    this.destroyedListener?.();
  }
}

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
  BrowserWindow: {
    fromWebContents: () => ({
      isVisible: () => windowState.visible,
      on: (event: string, listener: () => void) =>
        windowListeners.set(event, listener),
      removeListener: (event: string) => windowListeners.delete(event),
    }),
  },
}));

import {
  CHANNEL_SUBSCRIBE,
  ChannelBus,
  setupChannelBridge,
} from './channelBridge';

describe('channel bridge IPC boundary', () => {
  beforeEach(() => {
    handlers.clear();
    windowListeners.clear();
    windowState.visible = true;
  });

  it('validates requests and removes subscriptions when a renderer dies', () => {
    const bus = new ChannelBus();
    setupChannelBridge(bus);
    const subscribe = handlers.get(CHANNEL_SUBSCRIBE);
    const sender = new FakeSender();
    if (!subscribe) throw new Error('subscribe handler not installed');

    expect(() => subscribe({ sender }, 'unknown')).toThrow('Unknown channel');
    expect(() =>
      subscribe({ sender }, 'session.lifecycle', Number.NaN)
    ).toThrow('Event channels do not accept');
    expect(() => subscribe({ sender }, 123)).toThrow('Invalid channel name');

    subscribe({ sender }, 'session.lifecycle');
    expect(bus.subscriberCount('session.lifecycle')).toBe(1);
    expect(bus.registeredSubscriberCount('session.lifecycle')).toBe(1);

    windowState.visible = false;
    windowListeners.get('hide')?.();
    expect(bus.subscriberCount('session.lifecycle')).toBe(0);
    expect(bus.registeredSubscriberCount('session.lifecycle')).toBe(1);

    windowState.visible = true;
    windowListeners.get('show')?.();
    expect(bus.subscriberCount('session.lifecycle')).toBe(1);

    sender.destroy();
    expect(bus.subscriberCount('session.lifecycle')).toBe(0);
    expect(bus.registeredSubscriberCount('session.lifecycle')).toBe(0);
  });

  it('pauses demand on minimize and resumes it on restore', () => {
    const bus = new ChannelBus();
    setupChannelBridge(bus);
    const subscribe = handlers.get(CHANNEL_SUBSCRIBE);
    const sender = new FakeSender();
    if (!subscribe) throw new Error('subscribe handler not installed');

    subscribe({ sender }, 'session.lifecycle');
    expect(bus.subscriberCount('session.lifecycle')).toBe(1);

    // Platforms that keep reporting the window as visible while minimised rely
    // on the event to drop demand.
    windowListeners.get('minimize')?.();
    expect(bus.subscriberCount('session.lifecycle')).toBe(0);
    expect(bus.registeredSubscriberCount('session.lifecycle')).toBe(1);

    // Electron emits `restore`, never `show`, when leaving the minimised state.
    windowListeners.get('restore')?.();
    expect(bus.subscriberCount('session.lifecycle')).toBe(1);
  });

  it('reactivates a subscription that publish() deactivated while minimized', () => {
    const bus = new ChannelBus();
    setupChannelBridge(bus);
    const subscribe = handlers.get(CHANNEL_SUBSCRIBE);
    const sender = new FakeSender();
    if (!subscribe) throw new Error('subscribe handler not installed');

    subscribe({ sender }, 'session.lifecycle');

    // Platforms that report a minimised window as hidden let publish() drop the
    // subscription on its own — publish() deactivates but never reactivates.
    windowState.visible = false;
    bus.publish('session.lifecycle', { type: 'sessionNumChange' });
    expect(bus.subscriberCount('session.lifecycle')).toBe(0);

    windowState.visible = true;
    windowListeners.get('restore')?.();
    expect(bus.subscriberCount('session.lifecycle')).toBe(1);

    bus.publish('session.lifecycle', { type: 'sessionNumChange' });
    expect(sender.send).toHaveBeenCalled();
  });
});
