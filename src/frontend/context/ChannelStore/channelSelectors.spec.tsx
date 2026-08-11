import { act, renderHook } from '@testing-library/react';
import { shallow } from 'zustand/shallow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  SessionBarSnapshot,
  StandingsSnapshot,
  TrackStateSnapshot,
} from '@irdashies/types';
import {
  sessionBarSelectors,
  useSessionBarSelector,
} from './useSessionBarSnapshot';
import {
  standingsSelectors,
  useStandingsSelector,
} from './useStandingsSnapshot';
import {
  trackStateSelectors,
  useTrackStateSelector,
} from './useTrackStateSnapshot';

const createBridge = <K extends ChannelName>() => {
  let publish: ((payload: ChannelPayloads[K]) => void) | undefined;
  const subscribe = vi.fn(
    (_channel: K, callback: (payload: ChannelPayloads[K]) => void) => {
      publish = callback;
      return vi.fn();
    }
  );

  return {
    bridge: { subscribe } as unknown as ChannelBridge,
    publish: (snapshot: ChannelPayloads[K]) => publish?.(snapshot),
  };
};

afterEach(() => vi.restoreAllMocks());

describe('channel-specific selectors', () => {
  it('does not rerender a track-state consumer for unrelated fields', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const source = createBridge<'track-state.snapshot'>();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useTrackStateSelector(trackStateSelectors.isOnTrack, {
        bridge: source.bridge,
      });
    });

    act(() =>
      source.publish({
        isOnTrack: true,
        sessionTime: 1,
        version: 1,
      } as TrackStateSnapshot)
    );
    expect(result.current).toBe(true);
    const rendersAfterInitialSnapshot = renders;

    now = 40;
    act(() =>
      source.publish({
        isOnTrack: true,
        sessionTime: 2,
        version: 2,
      } as TrackStateSnapshot)
    );

    expect(renders).toBe(rendersAfterInitialSnapshot);
  });

  it('does not rerender a session-bar consumer for unrelated fields', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const source = createBridge<'session-bar.snapshot'>();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useSessionBarSelector(sessionBarSelectors.displayUnits, {
        bridge: source.bridge,
      });
    });

    act(() =>
      source.publish({
        displayUnits: 1,
        trackTemp: 25,
        version: 1,
      } as SessionBarSnapshot)
    );
    expect(result.current).toBe(1);
    const rendersAfterInitialSnapshot = renders;

    now = 200;
    act(() =>
      source.publish({
        displayUnits: 1,
        trackTemp: 26,
        version: 2,
      } as SessionBarSnapshot)
    );

    expect(renders).toBe(rendersAfterInitialSnapshot);
  });

  it('uses custom equality for selected standings arrays', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const source = createBridge<'standings.snapshot'>();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useStandingsSelector(standingsSelectors.carIdxLap, {
        bridge: source.bridge,
        equality: shallow,
      });
    });

    act(() =>
      source.publish({
        carIdxLap: [3, 4],
        sessionTime: 1,
        version: 1,
      } as StandingsSnapshot)
    );
    expect(result.current).toEqual([3, 4]);
    const rendersAfterInitialSnapshot = renders;

    now = 200;
    act(() =>
      source.publish({
        carIdxLap: [3, 4],
        sessionTime: 2,
        version: 2,
      } as StandingsSnapshot)
    );

    expect(renders).toBe(rendersAfterInitialSnapshot);
  });
});
