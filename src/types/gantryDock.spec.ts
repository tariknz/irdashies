import { describe, expect, it } from 'vitest';
import { resolveDockPanels, sanitizeGantryDock } from './gantryDock';
import { getWidgetDefaultConfig } from './defaultDashboard';
import type { DashboardLayout, DashboardWidget } from './dashboardLayout';

describe('sanitizeGantryDock', () => {
  it('falls back to the defaults for missing or broken values', () => {
    const expected = { enabled: false, arrangement: 'row', panels: [] };
    expect(sanitizeGantryDock(undefined)).toEqual(expected);
    expect(sanitizeGantryDock(null)).toEqual(expected);
    expect(sanitizeGantryDock('dock')).toEqual(expected);
    expect(sanitizeGantryDock([])).toEqual(expected);
    expect(
      sanitizeGantryDock({ enabled: 'yes', arrangement: 'grid', panels: {} })
    ).toEqual(expected);
  });

  it('matches the default dashboard config', () => {
    const { dock } = getWidgetDefaultConfig('gantry');
    expect(sanitizeGantryDock(dock)).toEqual(dock);
  });

  it('keeps a valid config as it is', () => {
    const dock = {
      enabled: true,
      arrangement: 'tabs',
      panels: [
        { id: 'a', type: 'fuel', widgetId: 'fuel-2' },
        { id: 'b', type: 'map' },
        { id: 'c', type: 'flatmap' },
      ],
    };
    expect(sanitizeGantryDock(dock)).toEqual(dock);
  });

  it('drops panel types that are not on the allowlist', () => {
    const result = sanitizeGantryDock({
      enabled: true,
      panels: [
        { id: 'a', type: 'relative' },
        { id: 'b', type: '__proto__' },
        { id: 'c', type: 'map' },
      ],
    });
    expect(result.panels).toEqual([{ id: 'c', type: 'map' }]);
  });

  it('drops panels without a usable id', () => {
    const result = sanitizeGantryDock({
      panels: [
        { type: 'map' },
        { id: 7, type: 'map' },
        { id: '', type: 'map' },
        'map',
        null,
        { id: 'ok', type: 'flatmap' },
      ],
    });
    expect(result.panels).toEqual([{ id: 'ok', type: 'flatmap' }]);
  });

  it('keeps a fuel panel with no source and drops a bad source id', () => {
    const result = sanitizeGantryDock({
      panels: [
        { id: 'a', type: 'fuel' },
        { id: 'b', type: 'fuel', widgetId: 42 },
      ],
    });
    expect(result.panels).toEqual([
      { id: 'a', type: 'fuel' },
      { id: 'b', type: 'fuel' },
    ]);
  });

  it('only keeps a source id on fuel panels', () => {
    const result = sanitizeGantryDock({
      panels: [{ id: 'a', type: 'map', widgetId: 'fuel' }],
    });
    expect(result.panels).toEqual([{ id: 'a', type: 'map' }]);
  });

  it('drops duplicate ids and duplicate targets', () => {
    const result = sanitizeGantryDock({
      panels: [
        { id: 'a', type: 'map' },
        { id: 'a', type: 'flatmap' },
        { id: 'b', type: 'map' },
        { id: 'c', type: 'fuel', widgetId: 'fuel' },
        { id: 'd', type: 'fuel', widgetId: 'fuel' },
      ],
    });
    expect(result.panels).toEqual([
      { id: 'a', type: 'map' },
      { id: 'c', type: 'fuel', widgetId: 'fuel' },
    ]);
  });

  it('keeps at most three panels', () => {
    const result = sanitizeGantryDock({
      panels: [
        { id: 'a', type: 'fuel', widgetId: 'fuel' },
        { id: 'b', type: 'fuel', widgetId: 'fuel-2' },
        { id: 'c', type: 'map' },
        { id: 'd', type: 'flatmap' },
      ],
    });
    expect(result.panels.map((panel) => panel.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not count dropped panels towards the limit', () => {
    const result = sanitizeGantryDock({
      panels: [
        { id: 'x', type: 'bogus' },
        { id: 'y', type: 'bogus' },
        { id: 'a', type: 'fuel', widgetId: 'fuel' },
        { id: 'b', type: 'map' },
        { id: 'c', type: 'flatmap' },
      ],
    });
    expect(result.panels.map((panel) => panel.id)).toEqual(['a', 'b', 'c']);
  });

  it('never returns the saved objects themselves', () => {
    const saved = { id: 'a', type: 'map', extra: 'dropped' };
    const [panel] = sanitizeGantryDock({ panels: [saved] }).panels;
    expect(panel).not.toBe(saved);
    expect(panel).toEqual({ id: 'a', type: 'map' });
  });
});

const layout = { x: 0, y: 0, width: 100, height: 100 };

const dashboardWith = (
  dock: unknown,
  widgets: DashboardWidget[] = []
): DashboardLayout => ({
  widgets: [
    { id: 'gantry', enabled: true, layout, config: { dock } },
    ...widgets,
  ],
});

describe('resolveDockPanels', () => {
  const fuel: DashboardWidget = { id: 'fuel', enabled: true, layout };
  const gantryFuel: DashboardWidget = {
    id: 'fuel-g1',
    type: 'fuel',
    enabled: true,
    layout,
    placement: 'gantry',
  };
  const map: DashboardWidget = { id: 'map', enabled: false, layout };
  const flatmap: DashboardWidget = { id: 'flatmap', enabled: true, layout };

  it('returns no panels without a dashboard or a Gantry widget', () => {
    expect(resolveDockPanels(undefined)).toEqual({
      arrangement: 'row',
      panels: [],
    });
    expect(resolveDockPanels({ widgets: [map] })).toEqual({
      arrangement: 'row',
      panels: [],
    });
  });

  it('returns no panels while the dock is turned off', () => {
    const dashboard = dashboardWith(
      {
        enabled: false,
        arrangement: 'tabs',
        panels: [{ id: 'a', type: 'map' }],
      },
      [map]
    );
    expect(resolveDockPanels(dashboard)).toEqual({
      arrangement: 'tabs',
      panels: [],
    });
  });

  it('links fuel panels by instance id and maps by type', () => {
    const dashboard = dashboardWith(
      {
        enabled: true,
        arrangement: 'row',
        panels: [
          { id: 'a', type: 'fuel', widgetId: 'fuel-g1' },
          { id: 'b', type: 'map' },
          { id: 'c', type: 'flatmap' },
        ],
      },
      [fuel, gantryFuel, map, flatmap]
    );

    const { panels } = resolveDockPanels(dashboard);

    expect(panels.map((p) => p.status)).toEqual(['ready', 'ready', 'ready']);
    expect(panels.map((p) => (p.status === 'ready' ? p.widget : null))).toEqual(
      [gantryFuel, map, flatmap]
    );
  });

  it('shows a disabled overlay widget, since the dock has its own switch', () => {
    const dashboard = dashboardWith(
      { enabled: true, panels: [{ id: 'b', type: 'map' }] },
      [map]
    );
    expect(resolveDockPanels(dashboard).panels[0].status).toBe('ready');
  });

  it('reports a fuel panel with no source as unlinked', () => {
    const dashboard = dashboardWith(
      { enabled: true, panels: [{ id: 'a', type: 'fuel' }] },
      [fuel]
    );
    expect(resolveDockPanels(dashboard).panels).toEqual([
      { panel: { id: 'a', type: 'fuel' }, status: 'unlinked' },
    ]);
  });

  it('reports a deleted fuel layout or missing map as removed', () => {
    const dashboard = dashboardWith(
      {
        enabled: true,
        panels: [
          { id: 'a', type: 'fuel', widgetId: 'fuel-gone' },
          { id: 'b', type: 'flatmap' },
        ],
      },
      [fuel]
    );
    expect(resolveDockPanels(dashboard).panels.map((p) => p.status)).toEqual([
      'removed',
      'removed',
    ]);
  });

  it('does not link a fuel panel to a widget of another type', () => {
    const dashboard = dashboardWith(
      {
        enabled: true,
        panels: [{ id: 'a', type: 'fuel', widgetId: 'map' }],
      },
      [map]
    );
    expect(resolveDockPanels(dashboard).panels[0].status).toBe('removed');
  });

  it('sanitises the saved dock before resolving it', () => {
    const dashboard = dashboardWith(
      {
        enabled: true,
        panels: [
          { id: 'a', type: 'relative' },
          { id: 'b', type: 'map' },
        ],
      },
      [map]
    );
    expect(resolveDockPanels(dashboard).panels.map((p) => p.panel.id)).toEqual([
      'b',
    ]);
  });

  describe('with the running sim', () => {
    const support = {
      message: 'nope',
      disabledWidgets: { iracing: [], lmu: ['map', 'fuel'] },
    };
    const dashboard = dashboardWith(
      {
        enabled: true,
        panels: [
          { id: 'a', type: 'fuel' },
          { id: 'b', type: 'map' },
          { id: 'c', type: 'flatmap' },
        ],
      },
      [map, flatmap]
    );
    const panelIds = (simulator: 'iracing' | 'lmu' | null) =>
      resolveDockPanels(dashboard, { support, simulator }).panels.map(
        (p) => p.panel.id
      );

    it('leaves out panels the sim cannot support, placeholders included', () => {
      expect(panelIds('lmu')).toEqual(['c']);
    });

    it('keeps every panel under a sim that supports them', () => {
      expect(panelIds('iracing')).toEqual(['a', 'b', 'c']);
    });

    it('hides nothing while no sim has been detected', () => {
      expect(panelIds(null)).toEqual(['a', 'b', 'c']);
    });
  });
});
