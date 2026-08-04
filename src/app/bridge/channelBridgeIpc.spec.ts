import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (
  event: { sender: FakeSender },
  channel: unknown,
  rate?: unknown
) => void;

const handlers = vi.hoisted(() => new Map<string, Handler>());

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
    fromWebContents: () => ({ isVisible: () => true }),
  },
}));

import {
  CHANNEL_SUBSCRIBE,
  ChannelBus,
  setupChannelBridge,
} from './channelBridge';

describe('channel bridge IPC boundary', () => {
  beforeEach(() => handlers.clear());

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
    sender.destroy();
    expect(bus.subscriberCount('session.lifecycle')).toBe(0);
  });
});
