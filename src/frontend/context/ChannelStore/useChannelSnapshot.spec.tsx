import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  ChannelPayloads,
  RadioSnapshot,
} from '@irdashies/types';
import { useChannelSelector, useChannelSnapshot } from './useChannelSnapshot';

const createBridge = () => {
  let publish: ((payload: RadioSnapshot) => void) | undefined;
  const unsubscribe = vi.fn();
  const subscribe = vi.fn(
    (_channel: string, callback: (payload: RadioSnapshot) => void) => {
      publish = callback;
      return unsubscribe;
    }
  );
  return {
    bridge: { subscribe } as unknown as ChannelBridge,
    subscribe,
    unsubscribe,
    publish: (snapshot: RadioSnapshot) => publish?.(snapshot),
  };
};

const radioSnapshot = (
  version: number,
  transmittingCarIdxs: readonly number[] = []
): ChannelPayloads['radio.snapshot'] => ({ transmittingCarIdxs, version });

describe('channel snapshot hooks', () => {
  it('uses one bridge subscription for multiple hooks on the same channel', () => {
    const source = createBridge();
    const { result, unmount } = renderHook(() => {
      const version = useChannelSelector(
        'radio.snapshot',
        (snapshot) => snapshot.version,
        { bridge: source.bridge }
      );
      const activeCount = useChannelSelector(
        'radio.snapshot',
        (snapshot) => snapshot.transmittingCarIdxs.length,
        { bridge: source.bridge }
      );
      return { version, activeCount };
    });

    expect(source.subscribe).toHaveBeenCalledOnce();
    act(() => source.publish(radioSnapshot(3, [1, 2])));
    expect(result.current).toEqual({ version: 3, activeCount: 2 });
    unmount();
    expect(source.unsubscribe).toHaveBeenCalledOnce();
  });

  it('does not rerender when an unrelated snapshot field changes', () => {
    let now = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const source = createBridge();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useChannelSelector(
        'radio.snapshot',
        (snapshot) => snapshot.transmittingCarIdxs.length,
        { bridge: source.bridge }
      );
    });

    act(() => source.publish(radioSnapshot(1, [7])));
    expect(result.current).toBe(1);
    const rendersAfterInitialSnapshot = renders;
    now = 40;
    act(() => source.publish(radioSnapshot(2, [9])));

    expect(renders).toBe(rendersAfterInitialSnapshot);
    nowSpy.mockRestore();
  });

  it('applies custom equality without requiring a stable inline selector', () => {
    let now = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const source = createBridge();
    let renders = 0;
    const equality = (previous: readonly number[], next: readonly number[]) =>
      previous.length === next.length &&
      previous.every((value, index) => value === next[index]);
    const { result } = renderHook(() => {
      renders += 1;
      return useChannelSelector(
        'radio.snapshot',
        (snapshot) => [...snapshot.transmittingCarIdxs],
        { bridge: source.bridge, equality }
      );
    });

    act(() => source.publish(radioSnapshot(1, [2, 4])));
    expect(result.current).toEqual([2, 4]);
    const rendersAfterInitialSnapshot = renders;
    now = 40;
    act(() => source.publish(radioSnapshot(2, [2, 4])));

    expect(renders).toBe(rendersAfterInitialSnapshot);
    expect(source.subscribe).toHaveBeenCalledOnce();
    nowSpy.mockRestore();
  });

  it('does not evaluate a slow selector when a fast selector rerenders their component', () => {
    let now = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const source = createBridge();
    const fastSelector = vi.fn((snapshot: RadioSnapshot) => snapshot.version);
    const slowSelector = vi.fn((snapshot: RadioSnapshot) => snapshot.version);
    const { result } = renderHook(() => ({
      fast: useChannelSelector('radio.snapshot', fastSelector, {
        bridge: source.bridge,
        rateHz: 25,
      }),
      slow: useChannelSelector('radio.snapshot', slowSelector, {
        bridge: source.bridge,
        rateHz: 5,
      }),
    }));

    act(() => source.publish(radioSnapshot(0)));
    now = 40;
    act(() => source.publish(radioSnapshot(1)));

    expect(result.current).toEqual({ fast: 1, slow: 0 });
    expect(fastSelector).toHaveBeenCalledTimes(2);
    expect(slowSelector).toHaveBeenCalledOnce();
    expect(source.subscribe).toHaveBeenCalledOnce();
    nowSpy.mockRestore();
  });

  it('does not expose newer snapshots through an inline slow selector rerender', () => {
    let now = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const source = createBridge();
    const slowEvaluations: number[] = [];
    const { result } = renderHook(() => ({
      fast: useChannelSelector(
        'radio.snapshot',
        (snapshot) => snapshot.version,
        { bridge: source.bridge, rateHz: 25 }
      ),
      slow: useChannelSelector(
        'radio.snapshot',
        (snapshot) => {
          slowEvaluations.push(snapshot.version);
          return snapshot.version;
        },
        { bridge: source.bridge, rateHz: 5 }
      ),
    }));

    act(() => source.publish(radioSnapshot(0)));
    now = 40;
    act(() => source.publish(radioSnapshot(1)));

    expect(result.current).toEqual({ fast: 1, slow: 0 });
    expect(slowEvaluations).not.toContain(1);
    nowSpy.mockRestore();
  });

  it('refreshes a selector that closes over changed props from the cached snapshot', () => {
    const source = createBridge();
    let renders = 0;
    const { result, rerender } = renderHook(
      ({ index }) => {
        renders += 1;
        return useChannelSelector(
          'radio.snapshot',
          (snapshot) => snapshot.transmittingCarIdxs[index],
          { bridge: source.bridge }
        );
      },
      { initialProps: { index: 0 } }
    );
    act(() => source.publish(radioSnapshot(1, [4, 8])));
    expect(result.current).toBe(4);
    const rendersBeforeSelectorChange = renders;

    rerender({ index: 1 });

    expect(result.current).toBe(8);
    expect(renders).toBe(rendersBeforeSelectorChange + 1);
    expect(source.subscribe).toHaveBeenCalledOnce();
    expect(source.unsubscribe).not.toHaveBeenCalled();
  });

  it('subscribes and unsubscribes safely as enabled changes', () => {
    const source = createBridge();
    const { rerender, unmount } = renderHook(
      ({ enabled }) =>
        useChannelSnapshot('radio.snapshot', undefined, source.bridge, enabled),
      { initialProps: { enabled: false } }
    );

    expect(source.subscribe).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(source.subscribe).toHaveBeenCalledOnce();
    rerender({ enabled: false });
    expect(source.unsubscribe).toHaveBeenCalledOnce();
    unmount();
    expect(source.unsubscribe).toHaveBeenCalledOnce();
  });
});
