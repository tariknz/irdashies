import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { useGantryAlwaysOnTop } from './useGantryAlwaysOnTop';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
  onDashboardUpdated: vi.fn(),
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: mocks.dashboard,
    onDashboardUpdated: mocks.onDashboardUpdated,
  }),
}));

const dashboardWith = (config: Record<string, unknown>) =>
  ({
    widgets: [
      { id: 'standings', enabled: true, config: { a: 1 } },
      { id: 'gantry', enabled: true, config },
    ],
  }) as unknown as DashboardLayout;

const savedGantry = () => {
  const saved = mocks.onDashboardUpdated.mock.calls.at(
    -1
  )?.[0] as DashboardLayout;
  return saved.widgets.find((w) => w.id === 'gantry')?.config;
};

describe('useGantryAlwaysOnTop', () => {
  beforeEach(() => {
    mocks.onDashboardUpdated.mockClear();
  });

  it.each([
    [{ window: { alwaysOnTop: true } }, true],
    [{ window: { alwaysOnTop: false } }, false],
    [{ window: { alwaysOnTop: 'true' } }, false],
    [{}, false],
  ])('reads %j as %s', (config, expected) => {
    mocks.dashboard = dashboardWith(config);
    const { result } = renderHook(() => useGantryAlwaysOnTop());

    expect(result.current[0]).toBe(expected);
  });

  it('is off before the dashboard loads', () => {
    mocks.dashboard = undefined;
    const { result } = renderHook(() => useGantryAlwaysOnTop());

    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(mocks.onDashboardUpdated).not.toHaveBeenCalled();
  });

  it('writes only the gantry window setting', () => {
    mocks.dashboard = dashboardWith({ speedUnit: 'mph', window: 'bad' });
    const { result } = renderHook(() => useGantryAlwaysOnTop());

    act(() => result.current[1](true));

    expect(savedGantry()).toEqual({
      speedUnit: 'mph',
      window: { alwaysOnTop: true },
    });
    const saved = mocks.onDashboardUpdated.mock.calls[0][0] as DashboardLayout;
    expect(saved.widgets[0]).toBe(mocks.dashboard.widgets[0]);
  });
});
