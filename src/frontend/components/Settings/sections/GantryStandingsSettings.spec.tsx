import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import { readGantryStandings } from './gantryStandingsEdits';
import { GantryStandingsSettings } from './GantryStandingsSettings';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
  navigate: vi.fn(),
  onDashboardUpdated: vi.fn(),
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: mocks.dashboard,
    onDashboardUpdated: mocks.onDashboardUpdated,
  }),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));

const layout = { x: 0, y: 0, width: 100, height: 100 };
const overlay: DashboardWidget = {
  id: 'standings',
  enabled: true,
  layout,
  config: { background: { opacity: 40 } },
};
const gantryLayout: DashboardWidget = {
  id: 'standings-g1',
  type: 'standings',
  enabled: true,
  layout,
  placement: 'gantry',
  config: {},
};

const dashboardWith = (
  standings: unknown,
  widgets: DashboardWidget[] = [overlay]
): DashboardLayout => ({
  widgets: [
    { id: 'gantry', enabled: true, layout, config: { standings } },
    ...widgets,
  ],
});

const saved = () =>
  mocks.onDashboardUpdated.mock.calls.at(-1)?.[0] as DashboardLayout;

describe('GantryStandingsSettings', () => {
  beforeEach(() => {
    mocks.onDashboardUpdated.mockClear();
    mocks.navigate.mockClear();
  });

  it('defaults to the built-in view and offers all three sources', () => {
    mocks.dashboard = dashboardWith(undefined);
    render(<GantryStandingsSettings />);

    const select = screen.getByRole('combobox', {
      name: 'Standings view',
    }) as HTMLSelectElement;
    expect(select.value).toBe('builtin');
    expect([...select.options].map((o) => o.value)).toEqual([
      'builtin',
      'overlay',
      'gantry',
    ]);
  });

  it('saves the chosen source', () => {
    mocks.dashboard = dashboardWith({ source: 'builtin' });
    render(<GantryStandingsSettings />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Standings view' }), {
      target: { value: 'overlay' },
    });

    expect(readGantryStandings(saved()).source).toBe('overlay');
  });

  it('creates a Gantry-only layout and opens its settings', () => {
    mocks.dashboard = dashboardWith({ source: 'gantry' });
    render(<GantryStandingsSettings />);

    fireEvent.click(
      screen.getByRole('button', { name: /Create Gantry standings layout/ })
    );

    const next = saved();
    const created = next.widgets.find((w) => w.placement === 'gantry');
    expect(created?.type).toBe('standings');
    expect(readGantryStandings(next)).toEqual({
      source: 'gantry',
      widgetId: created?.id,
    });
    expect(mocks.navigate).toHaveBeenCalledWith(`/settings/${created?.id}`);
  });

  it('edits and deletes an existing layout', () => {
    mocks.dashboard = dashboardWith(
      { source: 'gantry', widgetId: 'standings-g1' },
      [overlay, gantryLayout]
    );
    render(<GantryStandingsSettings />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit standings layout' })
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/settings/standings-g1');

    fireEvent.click(screen.getByRole('button', { name: /Delete layout/ }));
    const next = saved();
    expect(next.widgets.some((w) => w.id === 'standings-g1')).toBe(false);
    expect(readGantryStandings(next).source).toBe('builtin');
  });

  it('copies the overlay settings into the layout', () => {
    mocks.dashboard = dashboardWith(
      { source: 'gantry', widgetId: 'standings-g1' },
      [overlay, gantryLayout]
    );
    render(<GantryStandingsSettings />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Copy settings from overlay' })
    );

    expect(
      saved().widgets.find((w) => w.id === 'standings-g1')?.config
    ).toMatchObject({ background: { opacity: 40 } });
  });

  it('says so when the chosen layout was removed', () => {
    mocks.dashboard = dashboardWith({
      source: 'gantry',
      widgetId: 'standings-zz',
    });
    render(<GantryStandingsSettings />);

    expect(screen.getByText(/layout was removed/)).toBeTruthy();
  });
});
