import { describe, expect, it, vi } from 'vitest';
import type { ChannelBridge, SessionLifecycleEvent } from '@irdashies/types';
import { ChannelSnapshotStore } from './ChannelSnapshotStore';

describe('ChannelSnapshotStore', () => {
  it('shares one bridge subscription and disconnects the final listener', () => {
    let publish: ((payload: SessionLifecycleEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(
      (
        _channel: string,
        callback: (payload: SessionLifecycleEvent) => void
      ) => {
        publish = callback;
        return unsubscribe;
      }
    );
    const bridge = { subscribe } as unknown as ChannelBridge;
    const store = new ChannelSnapshotStore(
      'session.lifecycle',
      undefined,
      bridge
    );
    const first = vi.fn();
    const second = vi.fn();

    const removeFirst = store.subscribe(first);
    const removeSecond = store.subscribe(second);
    publish?.({ type: 'enter', replay: true });

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toEqual({ type: 'enter', replay: true });
    removeFirst();
    expect(unsubscribe).not.toHaveBeenCalled();
    removeSecond();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
