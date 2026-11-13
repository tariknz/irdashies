import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RacePlanBridge, RacePlanState } from '@irdashies/types';
import { connectRacePlanBridge, useRacePlanStore } from './RacePlanStore';

const state = (refreshMinutes: number) =>
  ({
    config: { planningId: null, strategyId: null, refreshMinutes },
  }) as RacePlanState;

const fakeBridge = (reply: Promise<RacePlanState>) => {
  const listeners = new Set<(s: RacePlanState) => void>();
  const unsubscribe = vi.fn();
  const bridge = {
    getState: vi.fn(() => reply),
    onStateChanged: vi.fn((callback: (s: RacePlanState) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
        unsubscribe();
      };
    }),
  } as unknown as RacePlanBridge;
  return {
    bridge,
    unsubscribe,
    push: (s: RacePlanState) => listeners.forEach((l) => l(s)),
  };
};

afterEach(() => useRacePlanStore.setState({ state: null }));

describe('RacePlanStore', () => {
  it('loads the state from the bridge', async () => {
    const { bridge } = fakeBridge(Promise.resolve(state(5)));
    const disconnect = connectRacePlanBridge(bridge);
    await vi.waitFor(() =>
      expect(useRacePlanStore.getState().state?.config.refreshMinutes).toBe(5)
    );
    disconnect();
  });

  it('keeps a pushed state over a late reply', async () => {
    let answer: (s: RacePlanState) => void = () => undefined;
    const fake = fakeBridge(new Promise((resolve) => (answer = resolve)));
    const disconnect = connectRacePlanBridge(fake.bridge);
    fake.push(state(9));
    answer(state(5));
    await Promise.resolve();
    await Promise.resolve();
    expect(useRacePlanStore.getState().state?.config.refreshMinutes).toBe(9);
    disconnect();
  });

  it('connects once and disconnects after the last user', () => {
    const fake = fakeBridge(new Promise(() => undefined));
    const first = connectRacePlanBridge(fake.bridge);
    const second = connectRacePlanBridge(fake.bridge);
    expect(fake.bridge.onStateChanged).toHaveBeenCalledTimes(1);
    first();
    expect(fake.unsubscribe).not.toHaveBeenCalled();
    second();
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a bridge', () => {
    expect(() => connectRacePlanBridge(undefined)()).not.toThrow();
  });
});
