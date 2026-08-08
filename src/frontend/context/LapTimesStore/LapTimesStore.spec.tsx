import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLapTimeHistory, useLapTimesStore } from './LapTimesStore';

describe('LapTimesStore', () => {
  beforeEach(() => useLapTimesStore.getState().reset());

  it('applies a channel snapshot without retaining readonly payload arrays', () => {
    const snapshot = {
      lapTimes: [90, 91],
      lapTimeHistory: [[90, 89], [91]],
      sessionNum: 2,
      version: 4,
    } as const;

    useLapTimesStore.getState().applySnapshot(snapshot);

    const state = useLapTimesStore.getState();
    expect(state.lapTimes).toEqual([90, 91]);
    expect(state.lapTimeBuffer).toEqual({
      lapTimeHistory: [[90, 89], [91]],
      version: 4,
    });
    expect(state.sessionNum).toBe(2);
    expect(state.lapTimes).not.toBe(snapshot.lapTimes);
    expect(state.lapTimeBuffer?.lapTimeHistory).not.toBe(
      snapshot.lapTimeHistory
    );
  });

  it('clears all session-derived state', () => {
    useLapTimesStore.getState().applySnapshot({
      lapTimes: [90],
      lapTimeHistory: [[90]],
      sessionNum: 1,
      version: 1,
    });

    useLapTimesStore.getState().reset();

    expect(useLapTimesStore.getState()).toMatchObject({
      lapTimeBuffer: null,
      lapTimes: [],
      sessionNum: null,
    });
  });

  it('does not rerender history consumers for equal snapshot values', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useLapTimeHistory();
    });
    const snapshot = {
      lapTimes: [90],
      lapTimeHistory: [[90, 89]],
      sessionNum: 1,
      version: 1,
    };

    act(() => useLapTimesStore.getState().applySnapshot(snapshot));
    expect(result.current).toEqual([[90, 89]]);
    expect(renders).toBe(2);

    act(() =>
      useLapTimesStore.getState().applySnapshot({
        ...snapshot,
        version: 2,
      })
    );
    expect(renders).toBe(2);
  });
});
