import { describe, expect, it, vi } from 'vitest';
import type { SessionLifecycle } from '../sessionLifecycle';
import { connectSessionLifecycleChannel } from './sessionLifecycleChannel';

describe('session lifecycle channel', () => {
  it('publishes source events and disconnects every listener', () => {
    const callbacks: Record<string, (...args: never[]) => void> = {};
    const removers = [vi.fn(), vi.fn(), vi.fn()];
    const lifecycle = {
      onEnter: (callback: () => void) => {
        callbacks.enter = callback;
        return removers[0];
      },
      onSessionNumChange: (callback: () => void) => {
        callbacks.sessionNumChange = callback;
        return removers[1];
      },
      onDisconnect: (callback: () => void) => {
        callbacks.disconnect = callback;
        return removers[2];
      },
    } as unknown as SessionLifecycle;
    const publish = vi.fn();
    const disconnect = connectSessionLifecycleChannel(lifecycle, {
      publish,
    } as never);

    callbacks.enter({ replay: true } as never);
    callbacks.sessionNumChange();
    callbacks.disconnect();

    expect(publish).toHaveBeenNthCalledWith(1, 'session.lifecycle', {
      type: 'enter',
      replay: true,
    });
    expect(publish).toHaveBeenNthCalledWith(2, 'session.lifecycle', {
      type: 'sessionNumChange',
    });
    expect(publish).toHaveBeenNthCalledWith(3, 'session.lifecycle', {
      type: 'disconnect',
    });

    disconnect();
    for (const remove of removers) expect(remove).toHaveBeenCalledOnce();
  });
});
