import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, LayoutNode } from '@irdashies/types';
import lapTraceManifest from '../../../../types/widgets/laptrace';
import { LapTraceSettings } from './LapTraceSettings';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
}));

vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    ...actual,
    useDashboard: () => ({
      currentDashboard: mocks.dashboard,
      onDashboardUpdated: vi.fn(),
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  };
});

const box = (widget: string): LayoutNode => ({
  id: `box-${widget}`,
  type: 'box',
  direction: 'col',
  widgets: [widget],
});

const withLayout = (layoutTree: LayoutNode) => {
  mocks.dashboard = {
    widgets: [
      {
        id: 'laptrace',
        enabled: true,
        layout: { x: 0, y: 0, width: 396, height: 120 },
        config: { ...lapTraceManifest.config, layoutTree },
      },
    ],
  } as unknown as DashboardLayout;
};

describe('LapTraceSettings', () => {
  beforeEach(() => {
    localStorage.setItem('lapTraceTab', 'corner');
  });

  afterEach(() => {
    localStorage.removeItem('lapTraceTab');
    mocks.dashboard = undefined;
  });

  it('offers how many corners to show whether the panel is beside, above or below the trace', () => {
    // Above or below the trace a tall enough widget shows every requested
    // row, so the count matters in every placement.
    for (const layoutTree of [
      {
        id: 'root',
        type: 'split',
        direction: 'row',
        children: [box('plot'), box('corners')],
      },
      {
        id: 'root',
        type: 'split',
        direction: 'col',
        children: [box('plot'), box('corners')],
      },
      {
        id: 'root',
        type: 'split',
        direction: 'col',
        children: [box('corners'), box('plot')],
      },
    ] as LayoutNode[]) {
      withLayout(layoutTree);
      const { unmount } = render(<LapTraceSettings />);
      expect(screen.getByText('Corners Shown')).toBeInTheDocument();
      unmount();
    }
  });
});
