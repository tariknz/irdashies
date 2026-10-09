import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import { readGantryDock } from './gantryDockEdits';
import { GantryDockSettings } from './GantryDockSettings';

const mocks = vi.hoisted(() => {
  let dashboard: DashboardLayout | undefined;
  const listeners = new Set<() => void>();
  return {
    listeners,
    navigate: vi.fn(),
    onDashboardUpdated: vi.fn(),
    getDashboard: () => dashboard,
    setDashboard: (next: DashboardLayout | undefined) => {
      dashboard = next;
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock('@irdashies/context', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useDashboard: () => ({
      currentDashboard: useSyncExternalStore((onChange) => {
        mocks.listeners.add(onChange);
        return () => mocks.listeners.delete(onChange);
      }, mocks.getDashboard),
      onDashboardUpdated: mocks.onDashboardUpdated,
    }),
  };
});

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));

const layout = { x: 0, y: 0, width: 100, height: 100 };
const overlayFuel: DashboardWidget = { id: 'fuel', enabled: true, layout };
const gantryFuel: DashboardWidget = {
  id: 'fuel-g1',
  type: 'fuel',
  enabled: true,
  layout,
  placement: 'gantry',
};
const map: DashboardWidget = { id: 'map', enabled: false, layout };

const dashboardWith = (
  panels: unknown[],
  widgets: DashboardWidget[] = [overlayFuel, gantryFuel, map],
  enabled = true
): DashboardLayout => ({
  widgets: [
    {
      id: 'gantry',
      enabled: true,
      layout,
      config: { dock: { enabled, arrangement: 'row', panels } },
    },
    ...widgets,
  ],
});

/** Every save is a whole dashboard; the latest one is what would persist. */
const saved = () =>
  mocks.onDashboardUpdated.mock.calls.at(-1)?.[0] as DashboardLayout;
const savedDock = () => readGantryDock(saved());

const panelRows = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-sortable-id]')).map(
    (row) => row.dataset.sortableId
  );

const row = (panelId: string) =>
  document.querySelector<HTMLElement>(
    `[data-sortable-id="${panelId}"]`
  ) as HTMLElement;

beforeEach(() => {
  mocks.onDashboardUpdated.mockClear();
  mocks.navigate.mockClear();
});

describe('GantryDockSettings', () => {
  it('turns the dock on and switches the arrangement', () => {
    mocks.setDashboard(dashboardWith([], undefined, false));
    render(<GantryDockSettings />);

    fireEvent.click(screen.getByRole('switch'));
    expect(savedDock().enabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Tabs' }));
    expect(savedDock().arrangement).toBe('tabs');
  });

  it('adds panels up to the limit and each map only once', () => {
    mocks.setDashboard(dashboardWith([{ id: 'p1', type: 'map' }]));
    render(<GantryDockSettings />);

    expect(
      screen.getByRole('button', { name: 'Add Track Map' })
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add Fuel Calculator' })
    );
    const panels = savedDock().panels;
    expect(panels).toHaveLength(2);
    expect(panels[1]).toMatchObject({ type: 'fuel' });
    expect(panels[1].id).not.toBe('p1');

    act(() =>
      mocks.setDashboard(
        dashboardWith([
          { id: 'p1', type: 'map' },
          { id: 'p2', type: 'flatmap' },
          { id: 'p3', type: 'fuel', widgetId: 'fuel' },
        ])
      )
    );
    expect(
      screen.getByRole('button', { name: 'Add Fuel Calculator' })
    ).toBeDisabled();
  });

  it('removes a panel on an overlay layout straight away', () => {
    mocks.setDashboard(
      dashboardWith([
        { id: 'p1', type: 'fuel', widgetId: 'fuel' },
        { id: 'p2', type: 'map' },
      ])
    );
    render(<GantryDockSettings />);

    fireEvent.click(
      within(row('p1')).getByRole('button', { name: 'Remove panel' })
    );

    expect(savedDock().panels.map((p) => p.id)).toEqual(['p2']);
    expect(saved().widgets.some((w) => w.id === 'fuel')).toBe(true);
  });

  it('offers to delete a Gantry-only layout when its panel is removed', () => {
    mocks.setDashboard(
      dashboardWith([{ id: 'p1', type: 'fuel', widgetId: 'fuel-g1' }])
    );
    render(<GantryDockSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove panel' }));
    expect(mocks.onDashboardUpdated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('button', { name: 'Delete layout' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete layout' }));

    expect(savedDock().panels).toEqual([]);
    expect(saved().widgets.some((w) => w.id === 'fuel-g1')).toBe(false);
  });

  it('keeps a Gantry-only layout when the user chooses to', () => {
    mocks.setDashboard(
      dashboardWith([{ id: 'p1', type: 'fuel', widgetId: 'fuel-g1' }])
    );
    render(<GantryDockSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep layout' }));

    expect(savedDock().panels).toEqual([]);
    expect(saved().widgets.some((w) => w.id === 'fuel-g1')).toBe(true);
  });

  it('reorders panels by dragging', () => {
    mocks.setDashboard(
      dashboardWith([
        { id: 'p1', type: 'fuel', widgetId: 'fuel' },
        { id: 'p2', type: 'map' },
      ])
    );
    render(<GantryDockSettings />);
    expect(panelRows()).toEqual(['p1', 'p2']);

    const dataTransfer = {
      setData: vi.fn(),
      setDragImage: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
    };
    // The drag image is a clone removed on the next frame; run it now so it
    // does not leak into later tests.
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });
    const handle = row('p1').querySelector('[draggable="true"]') as HTMLElement;
    fireEvent.dragStart(handle, { dataTransfer });
    raf.mockRestore();
    fireEvent.dragOver(row('p2'), { dataTransfer });
    fireEvent.drop(row('p2'), { dataTransfer });

    expect(savedDock().panels.map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('shows when the fuel layout a panel used was removed', () => {
    mocks.setDashboard(
      dashboardWith([{ id: 'p1', type: 'fuel', widgetId: 'fuel-gone' }])
    );
    render(<GantryDockSettings />);

    expect(
      screen.getByText(/The fuel layout this panel used was removed/)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
      target: { value: 'fuel' },
    });
    expect(savedDock().panels).toEqual([
      { id: 'p1', type: 'fuel', widgetId: 'fuel' },
    ]);
  });

  it('lists overlay and Gantry-only fuel layouts as sources', () => {
    mocks.setDashboard(dashboardWith([{ id: 'p1', type: 'fuel' }]));
    render(<GantryDockSettings />);

    const options = within(
      screen.getByRole('combobox', { name: 'Source' })
    ).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Choose a fuel layout',
      'Use overlay: Fuel Calculator',
      'Gantry-only layout: fuel-g1',
    ]);
  });

  it('creates a Gantry fuel layout and opens its settings', () => {
    mocks.setDashboard(dashboardWith([{ id: 'p1', type: 'fuel' }]));
    render(<GantryDockSettings />);

    fireEvent.click(
      screen.getByRole('button', { name: /Create Gantry fuel layout/ })
    );

    expect(mocks.onDashboardUpdated).toHaveBeenCalledOnce();
    const [panel] = savedDock().panels;
    const created = saved().widgets.find((w) => w.id === panel.widgetId);
    expect(created).toMatchObject({ type: 'fuel', placement: 'gantry' });
    expect(mocks.navigate).toHaveBeenCalledWith(`/settings/${created?.id}`);
  });

  it('links track map panels to their own settings page', () => {
    mocks.setDashboard(dashboardWith([{ id: 'p1', type: 'map' }]));
    render(<GantryDockSettings />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Track Map settings' })
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/settings/map');
  });
});
