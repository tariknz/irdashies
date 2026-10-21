import { describe, expect, it } from 'vitest';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import {
  createGantryFuelLayout,
  deleteFuelLayout,
  readGantryDock,
  removeDockPanel,
  withGantryDock,
} from './gantryDockEdits';

const layout = { x: 0, y: 0, width: 100, height: 100 };

const dashboard = (
  panels: unknown[],
  widgets: DashboardWidget[] = []
): DashboardLayout => ({
  widgets: [
    {
      id: 'gantry',
      enabled: true,
      layout,
      config: {
        speedUnit: 'auto',
        dock: { enabled: true, arrangement: 'row', panels },
      },
    },
    ...widgets,
  ],
});

const overlayFuel: DashboardWidget = { id: 'fuel', enabled: true, layout };
const gantryFuel: DashboardWidget = {
  id: 'fuel-g1',
  type: 'fuel',
  enabled: true,
  layout,
  placement: 'gantry',
};

describe('withGantryDock', () => {
  it('replaces only the dock and keeps the rest of the Gantry config', () => {
    const next = withGantryDock(dashboard([]), (dock) => ({
      ...dock,
      arrangement: 'tabs',
    }));
    const config = next.widgets[0].config as Record<string, unknown>;
    expect(config.speedUnit).toBe('auto');
    expect(readGantryDock(next).arrangement).toBe('tabs');
  });

  it('sanitises what it writes', () => {
    const next = withGantryDock(dashboard([]), (dock) => ({
      ...dock,
      panels: [
        { id: 'a', type: 'map' },
        { id: 'b', type: 'map' },
      ],
    }));
    expect(readGantryDock(next).panels).toEqual([{ id: 'a', type: 'map' }]);
  });
});

describe('createGantryFuelLayout', () => {
  it('adds a Gantry-only fuel widget and links the panel in one update', () => {
    const next = createGantryFuelLayout(
      dashboard([{ id: 'p1', type: 'fuel' }], [overlayFuel]),
      'p1',
      'fuel-new'
    );

    const created = next.widgets.find((w) => w.id === 'fuel-new');
    expect(created).toMatchObject({
      type: 'fuel',
      placement: 'gantry',
      enabled: true,
    });
    expect(created?.config?.showOnlyWhenOnTrack).toBe(false);
    expect(created?.config?.layoutTree).toBeDefined();
    expect(readGantryDock(next).panels).toEqual([
      { id: 'p1', type: 'fuel', widgetId: 'fuel-new' },
    ]);
  });
});

describe('removeDockPanel', () => {
  const start = dashboard(
    [
      { id: 'p1', type: 'fuel', widgetId: 'fuel-g1' },
      { id: 'p2', type: 'map' },
    ],
    [overlayFuel, gantryFuel]
  );

  it('keeps the Gantry-only layout unless asked to delete it', () => {
    const next = removeDockPanel(start, 'p1', false);
    expect(readGantryDock(next).panels.map((p) => p.id)).toEqual(['p2']);
    expect(next.widgets.some((w) => w.id === 'fuel-g1')).toBe(true);
  });

  it('deletes the Gantry-only layout when asked', () => {
    const next = removeDockPanel(start, 'p1', true);
    expect(readGantryDock(next).panels.map((p) => p.id)).toEqual(['p2']);
    expect(next.widgets.some((w) => w.id === 'fuel-g1')).toBe(false);
  });

  it('never deletes an overlay layout', () => {
    const next = removeDockPanel(
      dashboard([{ id: 'p1', type: 'fuel', widgetId: 'fuel' }], [overlayFuel]),
      'p1',
      true
    );
    expect(next.widgets.some((w) => w.id === 'fuel')).toBe(true);
    expect(readGantryDock(next).panels).toEqual([]);
  });
});

describe('deleteFuelLayout', () => {
  it('removes the dock panels of a deleted Gantry-only layout', () => {
    const next = deleteFuelLayout(
      dashboard(
        [
          { id: 'p1', type: 'fuel', widgetId: 'fuel-g1' },
          { id: 'p2', type: 'map' },
        ],
        [gantryFuel]
      ),
      'fuel-g1'
    );
    expect(next.widgets.some((w) => w.id === 'fuel-g1')).toBe(false);
    expect(readGantryDock(next).panels.map((p) => p.id)).toEqual(['p2']);
  });

  it('leaves a panel on a deleted overlay layout to show it was removed', () => {
    const fuel2: DashboardWidget = { ...overlayFuel, id: 'fuel-2' };
    const next = deleteFuelLayout(
      dashboard([{ id: 'p1', type: 'fuel', widgetId: 'fuel-2' }], [fuel2]),
      'fuel-2'
    );
    expect(next.widgets.some((w) => w.id === 'fuel-2')).toBe(false);
    expect(readGantryDock(next).panels).toEqual([
      { id: 'p1', type: 'fuel', widgetId: 'fuel-2' },
    ]);
  });
});
