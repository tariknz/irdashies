import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

describe('useChannelSnapshot', () => {
  it('subscribes and unsubscribes as enabled changes', () => {
    const unsubscribe = vi.fn();
    const bridge = {
      subscribe: vi.fn(() => unsubscribe),
    } as unknown as ChannelBridge;
    const { rerender, unmount } = renderHook(
      ({ enabled }) =>
        useChannelSnapshot('lap-times.snapshot', undefined, bridge, enabled),
      { initialProps: { enabled: false } }
    );

    expect(bridge.subscribe).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(bridge.subscribe).toHaveBeenCalledOnce();
    rerender({ enabled: false });
    expect(unsubscribe).toHaveBeenCalledOnce();
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
