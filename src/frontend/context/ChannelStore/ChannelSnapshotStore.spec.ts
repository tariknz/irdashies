import { describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  ChannelPayloads,
  RadioSnapshot,
} from '@irdashies/types';
import { ChannelSnapshotStore } from './ChannelSnapshotStore';

const radioSnapshot = (
  version: number,
  transmittingCarIdxs: readonly number[] = []
): RadioSnapshot => ({ transmittingCarIdxs, version });

const createBridge = () => {
  let publish: ((payload: RadioSnapshot) => void) | undefined;
  const activeUnsubscribes = new Set<ReturnType<typeof vi.fn>>();
  const activeCounts: number[] = [];
  const subscribe = vi.fn(
    (
      _channel: string,
      callback: (payload: RadioSnapshot) => void,
      rateHz?: number
    ) => {
      void rateHz;
      publish = callback;
      const unsubscribe = vi.fn();
      unsubscribe.mockImplementation(() => {
        activeUnsubscribes.delete(unsubscribe);
        activeCounts.push(activeUnsubscribes.size);
      });
      activeUnsubscribes.add(unsubscribe);
      activeCounts.push(activeUnsubscribes.size);
      return unsubscribe;
    }
  );
  return {
    bridge: { subscribe } as unknown as ChannelBridge,
    subscribe,
    publish: (snapshot: RadioSnapshot) => publish?.(snapshot),
    activeUnsubscribes,
    activeCounts,
  };
};

describe('ChannelSnapshotStore', () => {
  it('shares one active bridge subscription across selections', () => {
    const source = createBridge();
    const store = new ChannelSnapshotStore('radio.snapshot', source.bridge);
    const first = store.createSelection((snapshot) => snapshot.version);
    const second = store.createSelection(
      (snapshot) => snapshot.transmittingCarIdxs
    );
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const removeFirst = first.subscribe(firstListener);
    const removeSecond = second.subscribe(secondListener);
    source.publish(radioSnapshot(1, [4]));

    expect(source.subscribe).toHaveBeenCalledOnce();
    expect(source.activeUnsubscribes).toHaveLength(1);
    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).toHaveBeenCalledOnce();
    removeFirst();
    expect(source.activeUnsubscribes).toHaveLength(1);
    removeSecond();
    expect(source.activeUnsubscribes).toHaveLength(0);
    source.publish(radioSnapshot(2, [8]));
    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).toHaveBeenCalledOnce();
  });

  it('does not evaluate a slow selection at the fast selection cadence', () => {
    let now = 0;
    const source = createBridge();
    const store = new ChannelSnapshotStore('radio.snapshot', source.bridge, {
      now: () => now,
    });
    const fastSelector = vi.fn((snapshot: RadioSnapshot) => snapshot.version);
    const slowSelector = vi.fn((snapshot: RadioSnapshot) => snapshot.version);
    const fastListener = vi.fn();
    const slowListener = vi.fn();
    const fast = store.createSelection(fastSelector, Object.is, 25);
    const slow = store.createSelection(slowSelector, Object.is, 5);

    fast.subscribe(fastListener);
    slow.subscribe(slowListener);
    source.publish(radioSnapshot(0));
    for (let version = 1; version <= 5; version += 1) {
      now = version * 40;
      source.publish(radioSnapshot(version));
    }

    expect(fastSelector).toHaveBeenCalledTimes(6);
    expect(fastListener).toHaveBeenCalledTimes(6);
    expect(slowSelector).toHaveBeenCalledTimes(2);
    expect(slowListener).toHaveBeenCalledTimes(2);
    expect(source.subscribe.mock.calls.map((call) => call[2])).toEqual([25]);
  });

  it('uses custom equality to suppress unchanged notifications', () => {
    let now = 0;
    const source = createBridge();
    const store = new ChannelSnapshotStore('radio.snapshot', source.bridge, {
      now: () => now,
    });
    const listener = vi.fn();
    const selection = store.createSelection(
      (snapshot) => [...snapshot.transmittingCarIdxs],
      (previous, next) =>
        previous.length === next.length &&
        previous.every((value, index) => value === next[index])
    );
    selection.subscribe(listener);

    source.publish(radioSnapshot(1, [2, 7]));
    now = 40;
    source.publish(radioSnapshot(2, [2, 7]));
    now = 80;
    source.publish(radioSnapshot(3, [2, 8]));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(selection.getSnapshot()).toEqual([2, 8]);
  });

  it('refreshes a replaced selector from cache without notifying listeners', () => {
    const source = createBridge();
    const store = new ChannelSnapshotStore('radio.snapshot', source.bridge);
    const listener = vi.fn();
    const selection = store.createSelection(
      (snapshot) => snapshot.transmittingCarIdxs[0]
    );
    selection.subscribe(listener);
    source.publish(radioSnapshot(1, [3, 9]));

    selection.updateSelector(
      (snapshot) => snapshot.transmittingCarIdxs[1],
      Object.is
    );

    expect(selection.getSnapshot()).toBe(9);
    expect(listener).toHaveBeenCalledOnce();
    expect(source.subscribe).toHaveBeenCalledOnce();
  });

  it('isolates selector, equality, listener, and reporter exceptions', () => {
    let now = 0;
    const source = createBridge();
    const onError = vi.fn(() => {
      throw new Error('reporter failed');
    });
    const store = new ChannelSnapshotStore('radio.snapshot', source.bridge, {
      now: () => now,
      onError,
    });
    const broken = store.createSelection((snapshot) => {
      if (snapshot.version === 2) throw new Error('selector failed');
      return snapshot.version;
    });
    const brokenEquality = store.createSelection(
      (snapshot) => snapshot.version,
      () => {
        throw new Error('equality failed');
      }
    );
    const healthy = store.createSelection((snapshot) => snapshot.version);
    const brokenListener = vi.fn(() => {
      throw new Error('listener failed');
    });
    const equalityListener = vi.fn();
    const healthyListener = vi.fn();
    broken.subscribe(brokenListener);
    brokenEquality.subscribe(equalityListener);
    healthy.subscribe(healthyListener);

    source.publish(radioSnapshot(1));
    now = 40;
    source.publish(radioSnapshot(2));

    expect(brokenListener).toHaveBeenCalledOnce();
    expect(equalityListener).toHaveBeenCalledOnce();
    expect(healthyListener).toHaveBeenCalledTimes(2);
    expect(healthy.getSnapshot()).toBe(2);
    expect(onError).toHaveBeenCalledTimes(3);
  });

  it('downgrades bridge demand as faster selections leave', () => {
    const source = createBridge();
    const store = new ChannelSnapshotStore('radio.snapshot', source.bridge);
    const slow = store.createSelection(
      (snapshot) => snapshot.version,
      Object.is,
      5
    );
    const fast = store.createSelection(
      (snapshot) => snapshot.version,
      Object.is,
      25
    );

    const removeSlow = slow.subscribe(vi.fn());
    const removeFast = fast.subscribe(vi.fn());
    removeFast();

    expect(source.subscribe.mock.calls.map((call) => call[2])).toEqual([
      5, 25, 5,
    ]);
    expect(source.activeUnsubscribes).toHaveLength(1);
    expect(source.activeCounts).not.toContain(0);
    removeSlow();
    expect(source.activeUnsubscribes).toHaveLength(0);
  });

  it('accepts snapshots through the typed channel payload contract', () => {
    const source = createBridge();
    const store = new ChannelSnapshotStore('radio.snapshot', source.bridge);
    const selection = store.createSelection(
      (snapshot: ChannelPayloads['radio.snapshot']) => snapshot.version
    );
    selection.subscribe(vi.fn());
    source.publish(radioSnapshot(4));
    expect(selection.getSnapshot()).toBe(4);
  });
});
