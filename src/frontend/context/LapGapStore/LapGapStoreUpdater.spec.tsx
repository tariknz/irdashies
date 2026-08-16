import { act, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelBridge, SessionLifecycleEvent } from '@irdashies/types';
import { LapGapStoreUpdater } from './LapGapStoreUpdater';
import { useLapGapStore } from './LapGapStore';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';

// Backed by useSyncExternalStore (like the real channel hook) so that
// emitLap triggers a genuine re-render of the memoized updater component,
// rather than relying on parent-driven rerenders that memo would bail out of.
const lapListeners = new Set<() => void>();
let currentLap: number[] = [];
const emitLap = (next: number[]) => {
  currentLap = next;
  lapListeners.forEach((listener) => listener());
};

vi.mock('../ChannelStore/useStandingsSnapshot', () => ({
  standingsSelectors: {
    carIdxLap: (snapshot: { carIdxLap: number[] }) => snapshot.carIdxLap,
  },
  useStandingsSelector: () =>
    useSyncExternalStore(
      (listener: () => void) => {
        lapListeners.add(listener);
        return () => lapListeners.delete(listener);
      },
      () => currentLap
    ),
}));

vi.mock('@irdashies/domain/standings/useDriverStandings', () => ({
  useDriverStandings: vi.fn(),
}));

describe('LapGapStoreUpdater', () => {
  let publish: ((event: SessionLifecycleEvent) => void) | undefined;

  beforeEach(() => {
    useLapGapStore.getState().reset();
    publish = undefined;
    currentLap = [];

    const subscribe = vi.fn(
      (_channel: string, callback: (event: SessionLifecycleEvent) => void) => {
        publish = callback;
        return vi.fn();
      }
    );
    window.channelBridge = { subscribe } as unknown as ChannelBridge;

    vi.mocked(useDriverStandings).mockReturnValue([
      ['1', [{ carIdx: 0, gap: { value: 1.5, laps: 0 } }]],
    ] as unknown as ReturnType<typeof useDriverStandings>);
  });

  it('does not mount standings hooks while disabled', () => {
    render(<LapGapStoreUpdater enabled={false} />);

    expect(useDriverStandings).not.toHaveBeenCalled();
    expect(lapListeners.size).toBe(0);
  });

  it('clears lapGaps when session lifecycle emits sessionNumChange', () => {
    useLapGapStore.getState().recordLapGap(0, 3, 1.5);
    render(<LapGapStoreUpdater />);

    act(() => publish?.({ type: 'sessionNumChange' }));

    expect(useLapGapStore.getState().lapGaps).toEqual({});
  });

  it('clears lapGaps on disconnect', () => {
    useLapGapStore.getState().recordLapGap(0, 3, 1.5);
    render(<LapGapStoreUpdater />);

    act(() => publish?.({ type: 'disconnect' }));

    expect(useLapGapStore.getState().lapGaps).toEqual({});
  });

  it('does not record a stale-lap gap using the pre-reset lap baseline', () => {
    act(() => emitLap([40]));
    render(<LapGapStoreUpdater />);

    act(() => publish?.({ type: 'sessionNumChange' }));

    // New session's lap counter happens to pass the old session's stale
    // value on its very next tick; without clearing prevLapsRef this would
    // wrongly record a gap keyed to the old session's lap number.
    act(() => emitLap([41]));

    expect(useLapGapStore.getState().lapGaps[0]?.[40]).toBeUndefined();
  });

  it('resumes recording gaps once the new session establishes its own baseline', () => {
    act(() => emitLap([40]));
    render(<LapGapStoreUpdater />);

    act(() => publish?.({ type: 'sessionNumChange' }));

    act(() => emitLap([1]));
    expect(useLapGapStore.getState().lapGaps).toEqual({});

    act(() => emitLap([2]));
    expect(useLapGapStore.getState().lapGaps[0]?.[1]).toBe(1.5);
  });
});
