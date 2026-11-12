import { describe, expect, it, vi } from 'vitest';
import type { ActiveSimulator, DashboardBridge } from '@irdashies/types';
import {
  ActiveSimulatorStore,
  getActiveSimulatorStore,
} from './ActiveSimulatorStore';

type Change = (value: ActiveSimulator | null) => void;

const makeBridge = (initial: ActiveSimulator | null = 'iracing') => {
  const changeListeners: Change[] = [];
  const unsubscribe = vi.fn();
  const onSimulatorChanged = vi.fn((cb: Change) => {
    changeListeners.push(cb);
    return unsubscribe;
  });
  let resolveSeed: (value: ActiveSimulator | null) => void = () => undefined;
  const getActiveSimulator = vi.fn(
    () =>
      new Promise<ActiveSimulator | null>((resolve) => {
        resolveSeed = resolve;
      })
  );
  return {
    bridge: {
      onSimulatorChanged,
      getActiveSimulator,
    } as unknown as DashboardBridge,
    onSimulatorChanged,
    getActiveSimulator,
    unsubscribe,
    emit: (value: ActiveSimulator | null) =>
      changeListeners.forEach((cb) => cb(value)),
    seed: (value: ActiveSimulator | null = initial) => resolveSeed(value),
  };
};

describe('ActiveSimulatorStore', () => {
  it('opens one bridge subscription however many listeners attach', () => {
    // The point of the store. Before it, the standings opened one listener
    // per driver row.
    const h = makeBridge();
    const store = new ActiveSimulatorStore(h.bridge);

    const a = store.subscribe(vi.fn());
    const b = store.subscribe(vi.fn());
    const c = store.subscribe(vi.fn());

    expect(h.onSimulatorChanged).toHaveBeenCalledTimes(1);
    expect(h.getActiveSimulator).toHaveBeenCalledTimes(1);
    a();
    b();
    c();
  });

  it('releases the bridge only when the last listener leaves', () => {
    const h = makeBridge();
    const store = new ActiveSimulatorStore(h.bridge);
    const a = store.subscribe(vi.fn());
    const b = store.subscribe(vi.fn());

    a();
    expect(h.unsubscribe).not.toHaveBeenCalled();
    b();
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('notifies every listener on a change, once each', () => {
    const h = makeBridge();
    const store = new ActiveSimulatorStore(h.bridge);
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);

    h.emit('lmu');

    expect(store.getSnapshot()).toBe('lmu');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the value has not actually changed', () => {
    const h = makeBridge();
    const store = new ActiveSimulatorStore(h.bridge);
    const listener = vi.fn();
    store.subscribe(listener);

    h.emit('lmu');
    h.emit('lmu');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('hands a late subscriber the cached value immediately', () => {
    // A row mounting mid-session reads the current sim on its first render
    // rather than flashing null while its own request is in flight.
    const h = makeBridge();
    const store = new ActiveSimulatorStore(h.bridge);
    store.subscribe(vi.fn());
    h.emit('lmu');

    expect(store.getSnapshot()).toBe('lmu');
  });

  it('does not let a stale seed overwrite a newer change', async () => {
    // The seeding request answers for the moment it was made.
    const h = makeBridge();
    const store = new ActiveSimulatorStore(h.bridge);
    store.subscribe(vi.fn());

    h.emit('lmu');
    h.seed('iracing');
    await Promise.resolve();

    expect(store.getSnapshot()).toBe('lmu');
  });

  it('re-seeds when it reopens, because changes were missed while closed', async () => {
    const h = makeBridge();
    const store = new ActiveSimulatorStore(h.bridge);
    const first = store.subscribe(vi.fn());
    first();

    store.subscribe(vi.fn());

    expect(h.getActiveSimulator).toHaveBeenCalledTimes(2);
    h.seed('lmu');
    await Promise.resolve();
    expect(store.getSnapshot()).toBe('lmu');
  });

  it('ignores a seed that resolves after closing', async () => {
    const h = makeBridge();
    const store = new ActiveSimulatorStore(h.bridge);
    const unsubscribe = store.subscribe(vi.fn());
    unsubscribe();
    h.seed('iracing');
    await Promise.resolve();
    expect(store.getSnapshot()).toBeNull();
  });

  it('ignores an older seed after reopening', async () => {
    const h = makeBridge();
    const seeds: ((value: ActiveSimulator | null) => void)[] = [];
    h.getActiveSimulator.mockImplementation(
      () => new Promise((resolve) => seeds.push(resolve))
    );
    const store = new ActiveSimulatorStore(h.bridge);
    const unsubscribe = store.subscribe(vi.fn());
    unsubscribe();
    store.subscribe(vi.fn());
    seeds[1]('lmu');
    await Promise.resolve();
    seeds[0]('iracing');
    await Promise.resolve();
    expect(store.getSnapshot()).toBe('lmu');
  });

  it('survives a bridge that reports nothing at all', () => {
    const store = new ActiveSimulatorStore({} as DashboardBridge);
    const unsubscribe = store.subscribe(vi.fn());

    expect(store.getSnapshot()).toBeNull();
    expect(() => unsubscribe()).not.toThrow();
  });

  describe('loaded', () => {
    it('is false until the seed answers, and an answer of none counts', async () => {
      // Null before the answer is "not known yet"; null after it is "none
      // running", and a caller like Settings acts on the second only.
      const h = makeBridge();
      const store = new ActiveSimulatorStore(h.bridge);
      const listener = vi.fn();
      store.subscribe(listener);
      expect(store.getStatus()).toEqual({ simulator: null, loaded: false });

      h.seed(null);
      await Promise.resolve();

      expect(store.getStatus()).toEqual({ simulator: null, loaded: true });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('counts a change event as the answer', () => {
      const h = makeBridge();
      const store = new ActiveSimulatorStore(h.bridge);
      store.subscribe(vi.fn());

      h.emit('lmu');

      expect(store.getStatus()).toEqual({ simulator: 'lmu', loaded: true });
    });

    it('counts a failed seed as the answer, keeping what is known', async () => {
      const h = makeBridge();
      h.getActiveSimulator.mockImplementation(() =>
        Promise.reject(new Error())
      );
      const store = new ActiveSimulatorStore(h.bridge);
      store.subscribe(vi.fn());

      await Promise.resolve();
      await Promise.resolve();

      expect(store.getStatus()).toEqual({ simulator: null, loaded: true });
    });

    it('is true at once on a bridge that cannot be asked', () => {
      const store = new ActiveSimulatorStore({} as DashboardBridge);
      expect(store.getStatus()).toEqual({ simulator: null, loaded: true });
    });

    it('keeps the cached sim on reopening, but not as an answer until re-seeded', async () => {
      // Changes while closed went unseen, so the cached sim may be stale.
      const h = makeBridge();
      const store = new ActiveSimulatorStore(h.bridge);
      const first = store.subscribe(vi.fn());
      h.emit('lmu');
      first();

      store.subscribe(vi.fn());
      expect(store.getStatus()).toEqual({ simulator: 'lmu', loaded: false });

      h.seed('iracing');
      await Promise.resolve();
      expect(store.getStatus()).toEqual({ simulator: 'iracing', loaded: true });
    });

    it('keeps the same status object while nothing changes', () => {
      // useSyncExternalStore compares snapshots by identity.
      const h = makeBridge();
      const store = new ActiveSimulatorStore(h.bridge);
      store.subscribe(vi.fn());
      h.emit('lmu');
      const status = store.getStatus();

      h.emit('lmu');

      expect(store.getStatus()).toBe(status);
    });
  });
});

describe('getActiveSimulatorStore', () => {
  it('returns one store per bridge', () => {
    const a = makeBridge().bridge;
    const b = makeBridge().bridge;

    expect(getActiveSimulatorStore(a)).toBe(getActiveSimulatorStore(a));
    expect(getActiveSimulatorStore(a)).not.toBe(getActiveSimulatorStore(b));
  });
});
