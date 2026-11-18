import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChannelBridge, DriverControlsSnapshot } from '@irdashies/types';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { useInputs } from './useInputs';

const previousBridge = window.channelBridge;
afterEach(() => {
  cleanup();
  window.channelBridge = previousBridge;
});

const setup = (trace: boolean) => {
  let receive: ((snapshot: DriverControlsSnapshot) => void) | undefined;
  const off = vi.fn();
  window.channelBridge = {
    subscribe: (_channel, callback) => {
      receive = callback as (snapshot: DriverControlsSnapshot) => void;
      return off;
    },
  } as ChannelBridge;
  const config = structuredClone(getWidgetDefaultConfig('input'));
  config.layoutTree = {
    id: 'test',
    type: 'box',
    direction: 'row',
    widgets: trace ? ['trace'] : ['gear'],
  };
  const render = vi.fn();
  const hook = renderHook(() => {
    render();
    return useInputs(config);
  });
  const publish = (version: number, speed = 10) =>
    act(() =>
      receive?.({
        version,
        speed,
        gear: 3,
        rpm: 1000 + version,
        throttle: 0.5,
        brake: 0.2,
      })
    );
  return { ...hook, render, publish, off };
};

describe('Input React subscriptions', () => {
  it('does not rerender a gear-only display for 60 irrelevant updates', () => {
    const view = setup(false);
    view.publish(0);
    const initial = view.render.mock.calls.length;
    for (let version = 1; version <= 60; version++) view.publish(version);
    expect(view.render).toHaveBeenCalledTimes(initial);
    view.publish(61, 12);
    expect(view.render).toHaveBeenCalledTimes(initial + 1);
    view.unmount();
    expect(view.off).toHaveBeenCalledOnce();
  });

  it('preserves the source clock for all 60 samples of steady trace input', () => {
    const view = setup(true);
    view.publish(0);
    const initial = view.render.mock.calls.length;
    for (let version = 1; version <= 60; version++) view.publish(version);
    expect(view.render).toHaveBeenCalledTimes(initial + 60);
    expect(view.result.current.traceTick).toBe(60);
  });
});
