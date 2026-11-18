import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  type DashboardBridge,
  type SimWidgetSupportConfig,
} from '@irdashies/types';
import { useSimWidgetSupportStatus } from './useSimWidgetSupport';

const bridge = vi.hoisted(() => ({
  current: undefined as Partial<DashboardBridge> | undefined,
}));

vi.mock('../DashboardContext/DashboardContext', () => ({
  useDashboardBridge: () => bridge.current,
}));

const fromFile: SimWidgetSupportConfig = {
  message: 'From the file',
  disabledWidgets: { iracing: [], lmu: [] },
};

describe('useSimWidgetSupportStatus', () => {
  beforeEach(() => {
    bridge.current = undefined;
  });

  it('starts on the defaults, not loaded, and takes the file when it arrives', async () => {
    let answer: (config: SimWidgetSupportConfig) => void = () => undefined;
    bridge.current = {
      getSimWidgetSupport: () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    };
    const { result } = renderHook(() => useSimWidgetSupportStatus());
    expect(result.current).toEqual({
      config: DEFAULT_SIM_WIDGET_SUPPORT,
      loaded: false,
    });

    await act(async () => answer(fromFile));
    expect(result.current).toEqual({ config: fromFile, loaded: true });
  });

  it('is loaded at once when there is no file to ask for', () => {
    bridge.current = {};
    const { result } = renderHook(() => useSimWidgetSupportStatus());
    expect(result.current).toEqual({
      config: DEFAULT_SIM_WIDGET_SUPPORT,
      loaded: true,
    });
  });

  it('keeps the defaults and stops waiting when the request fails', async () => {
    bridge.current = {
      getSimWidgetSupport: () => Promise.reject(new Error('no answer')),
    };
    const { result } = renderHook(() => useSimWidgetSupportStatus());
    await act(async () => undefined);
    expect(result.current).toEqual({
      config: DEFAULT_SIM_WIDGET_SUPPORT,
      loaded: true,
    });
  });
});
