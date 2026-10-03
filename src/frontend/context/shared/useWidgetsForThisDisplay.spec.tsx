import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  type ActiveSimulator,
  type ContainerBoundsInfo,
  type DashboardWidget,
  type SimWidgetSupportConfig,
} from '@irdashies/types';

const dashboard = vi.hoisted(() => ({
  widgets: [] as DashboardWidget[],
  containerBoundsInfo: null as ContainerBoundsInfo | null,
}));

const main = vi.hoisted(() => ({
  simulator: null as ActiveSimulator | null,
  support: undefined as SimWidgetSupportConfig | undefined,
}));

vi.mock('../DashboardContext/DashboardContext', () => ({
  useDashboard: () => ({
    currentDashboard: { widgets: dashboard.widgets },
    containerBoundsInfo: dashboard.containerBoundsInfo,
  }),
  useDashboardBridge: () => ({
    getActiveSimulator: () => Promise.resolve(main.simulator),
    getSimWidgetSupport: () => Promise.resolve(main.support),
    onSimulatorChanged: () => () => undefined,
  }),
}));

import { useWidgetsForThisDisplay } from './useWidgetsForThisDisplay';

const widget = (id: string, x: number): DashboardWidget => ({
  id,
  enabled: true,
  layout: { x, y: 0, width: 100, height: 100 },
});

const ids = (widgets: DashboardWidget[]) => widgets.map((w) => w.id);

describe('useWidgetsForThisDisplay', () => {
  beforeEach(() => {
    dashboard.widgets = [widget('input', 0), widget('standings', 200)];
    dashboard.containerBoundsInfo = null;
    main.simulator = null;
    main.support = {
      message: 'nope',
      disabledWidgets: { iracing: ['standings'], lmu: [] },
    };
  });

  it('drops the widgets the running sim cannot support', async () => {
    // One overlay window can span several widgets, so an unsupported widget
    // between two supported ones sits inside a window that was built anyway.
    // Window creation alone does not hide it -- this selector has to.
    main.simulator = 'iracing';

    const { result } = renderHook(() => useWidgetsForThisDisplay());

    await waitFor(() => expect(ids(result.current)).toEqual(['input']));
  });

  it('keeps the widget when another sim is running', async () => {
    main.simulator = 'lmu';

    const { result } = renderHook(() => useWidgetsForThisDisplay());

    await waitFor(() =>
      expect(ids(result.current)).toEqual(['input', 'standings'])
    );
  });

  it('hides nothing while no simulator has been detected', async () => {
    // With no sim to be incompatible with, hiding widgets would be guessing.
    const { result } = renderHook(() => useWidgetsForThisDisplay());

    await waitFor(() =>
      expect(ids(result.current)).toEqual(['input', 'standings'])
    );
  });

  it('filters the browser view too, where display bounds do not apply', async () => {
    // The browser renderer skips the display scoping, but compatibility is
    // about the sim rather than the screen.
    main.simulator = 'iracing';

    const { result } = renderHook(() => useWidgetsForThisDisplay(true));

    await waitFor(() => expect(ids(result.current)).toEqual(['input']));
  });

  it('still respects the widget the user switched off', async () => {
    main.support = DEFAULT_SIM_WIDGET_SUPPORT;
    main.simulator = 'iracing';
    dashboard.widgets = [
      { ...widget('input', 0), enabled: false },
      widget('standings', 200),
    ];

    const { result } = renderHook(() => useWidgetsForThisDisplay());

    await waitFor(() => expect(ids(result.current)).toEqual(['standings']));
  });

  it('scopes to this display after the compatibility filter', async () => {
    main.simulator = 'iracing';
    dashboard.widgets = [
      widget('input', 0),
      widget('standings', 200),
      widget('relative', 1200),
    ];
    dashboard.containerBoundsInfo = {
      displayId: 1,
      isPrimary: true,
      expected: { x: 0, y: 0, width: 1000, height: 1000 },
      actual: { x: 0, y: 0, width: 1000, height: 1000 },
      offset: { x: 0, y: 0 },
      displayBounds: { x: 0, y: 0, width: 1000, height: 1000 },
      allDisplayBounds: [
        { x: 0, y: 0, width: 1000, height: 1000 },
        { x: 1000, y: 0, width: 1000, height: 1000 },
      ],
    };

    const { result } = renderHook(() => useWidgetsForThisDisplay());

    // 'standings' is incompatible, 'relative' lives on the other display.
    await waitFor(() => expect(ids(result.current)).toEqual(['input']));
  });
});
