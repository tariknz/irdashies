import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChannelBridge, SessionLifecycleEvent } from '@irdashies/types';
import { useSessionLifecycle } from './useSessionLifecycle';

describe('useSessionLifecycle', () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).channelBridge;
  });

  it('subscribes to session.lifecycle on mount', () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    window.channelBridge = { subscribe } as unknown as ChannelBridge;

    renderHook(() => useSessionLifecycle(vi.fn()));

    expect(subscribe).toHaveBeenCalledWith(
      'session.lifecycle',
      expect.any(Function)
    );
  });

  it('invokes the handler when the bridge emits an event', () => {
    let publish: ((event: SessionLifecycleEvent) => void) | undefined;
    const subscribe = vi.fn(
      (_channel: string, callback: (event: SessionLifecycleEvent) => void) => {
        publish = callback;
        return vi.fn();
      }
    );
    window.channelBridge = { subscribe } as unknown as ChannelBridge;
    const handler = vi.fn();

    renderHook(() => useSessionLifecycle(handler));
    publish?.({ type: 'sessionNumChange' });

    expect(handler).toHaveBeenCalledWith({ type: 'sessionNumChange' });
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    window.channelBridge = { subscribe } as unknown as ChannelBridge;

    const { unmount } = renderHook(() => useSessionLifecycle(vi.fn()));
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('does not throw when window.channelBridge is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).channelBridge;

    expect(() => renderHook(() => useSessionLifecycle(vi.fn()))).not.toThrow();
  });

  it('does not resubscribe when the caller passes a new inline handler on re-render', () => {
    const subscribe = vi.fn(() => vi.fn());
    window.channelBridge = { subscribe } as unknown as ChannelBridge;

    const { rerender } = renderHook(
      ({ handler }: { handler: (event: SessionLifecycleEvent) => void }) =>
        useSessionLifecycle(handler),
      { initialProps: { handler: vi.fn() } }
    );

    rerender({ handler: vi.fn() });
    rerender({ handler: vi.fn() });

    expect(subscribe).toHaveBeenCalledOnce();
  });

  it('calls the latest handler even after a re-render with a new inline handler', () => {
    let publish: ((event: SessionLifecycleEvent) => void) | undefined;
    const subscribe = vi.fn(
      (_channel: string, callback: (event: SessionLifecycleEvent) => void) => {
        publish = callback;
        return vi.fn();
      }
    );
    window.channelBridge = { subscribe } as unknown as ChannelBridge;

    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const { rerender } = renderHook(
      ({ handler }: { handler: (event: SessionLifecycleEvent) => void }) =>
        useSessionLifecycle(handler),
      { initialProps: { handler: firstHandler } }
    );

    rerender({ handler: secondHandler });
    publish?.({ type: 'disconnect' });

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith({ type: 'disconnect' });
  });
});
