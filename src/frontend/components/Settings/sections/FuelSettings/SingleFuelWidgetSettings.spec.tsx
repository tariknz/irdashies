import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWidgetDefaultConfig,
  type DashboardLayout,
  type DashboardWidget,
} from '@irdashies/types';
import { readGantryDock } from '../gantryDockEdits';
import { SingleFuelWidgetSettings } from './SingleFuelWidgetSettings';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
  onDashboardUpdated: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@irdashies/context', async () => {
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: mocks.dashboard,
      onDashboardUpdated: mocks.onDashboardUpdated,
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  };
});

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));

const layout = { x: 0, y: 0, width: 100, height: 100 };
const config = getWidgetDefaultConfig('fuel') as unknown as Record<
  string,
  unknown
>;
const overlayFuel: DashboardWidget = {
  id: 'fuel',
  enabled: true,
  layout,
  config,
};
const gantryFuel: DashboardWidget = {
  id: 'fuel-g1',
  type: 'fuel',
  enabled: true,
  layout,
  config,
  placement: 'gantry',
};

beforeEach(() => {
  mocks.onDashboardUpdated.mockClear();
  mocks.dashboard = {
    widgets: [
      {
        id: 'gantry',
        enabled: true,
        layout,
        config: {
          dock: {
            enabled: true,
            arrangement: 'row',
            panels: [{ id: 'p1', type: 'fuel', widgetId: 'fuel-g1' }],
          },
        },
      },
      overlayFuel,
      gantryFuel,
    ],
  };
});

describe('SingleFuelWidgetSettings for a Gantry-only layout', () => {
  it('shows a Gantry badge and marks it in the layout list', () => {
    localStorage.setItem('fuelWidgetTab', 'layout');
    render(<SingleFuelWidgetSettings widgetId="fuel-g1" />);

    expect(screen.getByText('Gantry')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'fuel-g1 (Gantry)' })
    ).toBeInTheDocument();
  });

  it('hides the overlay-only options', () => {
    localStorage.setItem('fuelWidgetTab', 'visibility');
    render(<SingleFuelWidgetSettings widgetId="fuel-g1" />);

    expect(
      screen.queryByText('Show only when on track')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset Position' })
    ).not.toBeInTheDocument();
  });

  it('keeps them for an overlay layout', () => {
    localStorage.setItem('fuelWidgetTab', 'visibility');
    render(<SingleFuelWidgetSettings widgetId="fuel" />);

    expect(screen.getByText('Show only when on track')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reset Position' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Gantry')).not.toBeInTheDocument();
  });

  it('removes its dock panel when the layout is deleted', () => {
    localStorage.setItem('fuelWidgetTab', 'layout');
    render(<SingleFuelWidgetSettings widgetId="fuel-g1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Layout' }));

    const saved = mocks.onDashboardUpdated.mock.calls[0][0] as DashboardLayout;
    expect(saved.widgets.some((w) => w.id === 'fuel-g1')).toBe(false);
    expect(readGantryDock(saved).panels).toEqual([]);
  });
});
