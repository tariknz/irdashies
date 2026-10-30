import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWidgetDefaultConfig,
  type DashboardLayout,
  type DashboardWidget,
} from '@irdashies/types';
import { StandingsSettings } from './StandingsSettings';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
  onDashboardUpdated: vi.fn(),
}));

vi.mock('@irdashies/context', async () => {
  const { DEFAULT_SIM_WIDGET_SUPPORT: support } =
    await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: mocks.dashboard,
      onDashboardUpdated: mocks.onDashboardUpdated,
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => support,
  };
});

const layout = { x: 0, y: 0, width: 100, height: 100 };
const config = (opacity: number) => ({
  ...getWidgetDefaultConfig('standings'),
  background: { opacity },
});

const overlay: DashboardWidget = {
  id: 'standings',
  enabled: true,
  layout,
  config: config(80) as unknown as Record<string, unknown>,
};
const gantryLayout: DashboardWidget = {
  id: 'standings-g1',
  type: 'standings',
  enabled: true,
  layout,
  placement: 'gantry',
  config: config(20) as unknown as Record<string, unknown>,
};

const tab = (name: string) => screen.queryByRole('button', { name });

describe('StandingsSettings', () => {
  beforeEach(() => {
    mocks.onDashboardUpdated.mockClear();
    localStorage.clear();
    mocks.dashboard = { widgets: [overlay, gantryLayout] };
  });

  it('is the overlay page by default', () => {
    render(<StandingsSettings />);

    expect(tab('Visibility')).not.toBeNull();
    expect(screen.queryByText('Gantry')).toBeNull();
    expect(screen.queryByText('Copy settings from overlay')).toBeNull();
  });

  it('edits the Gantry-only layout it is given and marks it', () => {
    render(<StandingsSettings widgetId="standings-g1" />);

    expect(screen.getByText('Gantry')).toBeTruthy();
    expect(tab('Visibility')).toBeNull();
    expect(screen.queryByText('Reset Position')).toBeNull();
  });

  it('copies the overlay settings into the layout', () => {
    render(<StandingsSettings widgetId="standings-g1" />);

    fireEvent.click(screen.getByText('Copy settings from overlay'));

    const next = mocks.onDashboardUpdated.mock.calls.at(-1)?.[0] as
      DashboardLayout | undefined;
    expect(
      next?.widgets.find((w) => w.id === 'standings-g1')?.config
    ).toMatchObject({ background: { opacity: 80 } });
  });

  it('has no enabled switch on a Gantry-only layout', () => {
    const headerSwitch = () =>
      screen
        .getByRole('heading', { level: 2 })
        .parentElement?.querySelector('[role="switch"]') ?? null;
    mocks.dashboard = {
      widgets: [overlay, { ...gantryLayout, placement: undefined }],
    };
    const { unmount } = render(<StandingsSettings widgetId="standings-g1" />);
    expect(headerSwitch()).not.toBeNull();
    unmount();

    mocks.dashboard = { widgets: [overlay, gantryLayout] };
    render(<StandingsSettings widgetId="standings-g1" />);
    expect(headerSwitch()).toBeNull();
  });
});
