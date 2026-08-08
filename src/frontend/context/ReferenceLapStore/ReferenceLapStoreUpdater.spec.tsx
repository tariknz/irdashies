import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  ReferenceLap,
  ReferenceLapsSnapshot,
} from '@irdashies/types';
import { useReferenceLapStore } from './ReferenceLapStore';
import { useReferenceLapStoreUpdater } from './ReferenceLapStoreUpdater';

const lap = (finishTime: number): ReferenceLap => ({
  startTime: 0,
  finishTime,
  times: new Float32Array([0, finishTime]),
  pointPos: new Float32Array([0, 0.5]),
  tangents: new Float32Array(2),
  interval: 0.5,
  pointsCount: 2,
  lastTrackedPct: 0.99,
  isCleanLap: true,
});

describe('useReferenceLapStoreUpdater', () => {
  beforeEach(() => useReferenceLapStore.getState().completeSession());

  it('mirrors channel snapshots into the compatibility store', () => {
    let listener: ((snapshot: ReferenceLapsSnapshot) => void) | undefined;
    const unsubscribe = vi.fn();
    const bridge = {
      subscribe: vi.fn((_channel, callback) => {
        listener = callback as (snapshot: ReferenceLapsSnapshot) => void;
        return unsubscribe;
      }),
    } as unknown as ChannelBridge;

    const { unmount } = renderHook(() => useReferenceLapStoreUpdater(bridge));
    const best = lap(60);
    const persisted = lap(61);
    act(() => {
      listener?.({
        bestLaps: [[4, best]],
        persistedLaps: [[12, persisted]],
        sessionNum: 1,
        version: 1,
      });
    });

    expect(useReferenceLapStore.getState().bestLaps.get(4)).toBe(best);
    expect(useReferenceLapStore.getState().persistedLaps.get(12)).toBe(
      persisted
    );
    act(() => {
      listener?.({
        bestLaps: [],
        persistedLaps: [[12, persisted]],
        sessionNum: 1,
        version: 2,
      });
    });
    expect(useReferenceLapStore.getState().bestLaps.get(4)).toBeUndefined();
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(useReferenceLapStore.getState().bestLaps.size).toBe(0);
  });

  it('does nothing when the channel bridge is unavailable', () => {
    expect(() =>
      renderHook(() => useReferenceLapStoreUpdater(undefined))
    ).not.toThrow();
  });
});
