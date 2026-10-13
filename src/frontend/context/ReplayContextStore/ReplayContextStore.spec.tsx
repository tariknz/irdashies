import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelBridge, ReplayContextSnapshot } from '@irdashies/types';
import {
  INITIAL_REPLAY_CONTEXT,
  useReplayContextSnapshot,
  useReplayContextStore,
} from './ReplayContextStore';
import { useReplayContextUpdater } from './useReplayContextUpdater';
import { useResetOnDisconnect } from '../shared/useResetOnDisconnect';

const archivedReplay: ReplayContextSnapshot = {
  mode: 'replayFile',
  provenance: 'archived',
  subSessionId: '81269102',
  archivedSessionNums: [0, 2],
  version: 3,
};

const createBridge = () => {
  let publish: ((payload: ReplayContextSnapshot) => void) | undefined;
  const subscribe = vi.fn(
    (_channel: string, callback: (payload: ReplayContextSnapshot) => void) => {
      publish = callback;
      return () => undefined;
    }
  );
  return {
    bridge: { subscribe } as unknown as ChannelBridge,
    subscribe,
    publish: (snapshot: ReplayContextSnapshot) => publish?.(snapshot),
  };
};

describe('ReplayContextStore', () => {
  beforeEach(() => {
    useReplayContextStore.getState().reset();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).channelBridge;
  });

  it('starts as a live session with no provenance', () => {
    const { result } = renderHook(() => useReplayContextSnapshot());

    expect(result.current).toEqual(INITIAL_REPLAY_CONTEXT);
  });

  it('copies each replay.context delivery into the store', () => {
    const source = createBridge();
    window.channelBridge = source.bridge;
    renderHook(() => useReplayContextUpdater());
    const { result } = renderHook(() => useReplayContextSnapshot());

    act(() => source.publish(archivedReplay));

    expect(source.subscribe.mock.calls[0][0]).toBe('replay.context');
    expect(result.current).toEqual(archivedReplay);
  });

  it('resets when the sim disconnects', () => {
    useReplayContextStore.getState().setSnapshot(archivedReplay);
    const { rerender } = renderHook(
      ({ running }) => useResetOnDisconnect(running),
      { initialProps: { running: true } }
    );

    rerender({ running: false });

    expect(useReplayContextStore.getState().snapshot).toEqual(
      INITIAL_REPLAY_CONTEXT
    );
  });
});
