import { describe, expect, it } from 'vitest';
import { getWidgetDefaultConfig } from './defaultDashboard';
import {
  resolveGantryStandings,
  sanitizeGantryStandings,
} from './gantryStandings';
import type { DashboardLayout, DashboardWidget } from './dashboardLayout';

const layout = { x: 0, y: 0, width: 100, height: 100 };
const overlay: DashboardWidget = { id: 'standings', enabled: true, layout };
const gantryLayout: DashboardWidget = {
  id: 'standings-g1',
  type: 'standings',
  enabled: true,
  layout,
  placement: 'gantry',
};

const dashboardWith = (
  standings: unknown,
  widgets: DashboardWidget[] = [overlay, gantryLayout]
): DashboardLayout => ({
  widgets: [
    { id: 'gantry', enabled: true, layout, config: { standings } },
    ...widgets,
  ],
});

describe('sanitizeGantryStandings', () => {
  it('falls back to the built-in view for missing or broken values', () => {
    const expected = { source: 'builtin' };
    expect(sanitizeGantryStandings(undefined)).toEqual(expected);
    expect(sanitizeGantryStandings('overlay')).toEqual(expected);
    expect(sanitizeGantryStandings({ source: 'grid' })).toEqual(expected);
  });

  it('matches the default dashboard config', () => {
    const { standings } = getWidgetDefaultConfig('gantry');
    expect(sanitizeGantryStandings(standings)).toEqual(standings);
  });

  it('keeps the layout id only when it is a non-empty string', () => {
    expect(
      sanitizeGantryStandings({ source: 'gantry', widgetId: 'standings-g1' })
    ).toEqual({ source: 'gantry', widgetId: 'standings-g1' });
    expect(sanitizeGantryStandings({ source: 'gantry', widgetId: 4 })).toEqual({
      source: 'gantry',
    });
    expect(sanitizeGantryStandings({ source: 'gantry', widgetId: '' })).toEqual(
      { source: 'gantry' }
    );
  });
});

describe('resolveGantryStandings', () => {
  it('uses the built-in view by default', () => {
    expect(resolveGantryStandings(undefined)).toEqual({ status: 'builtin' });
    expect(
      resolveGantryStandings(dashboardWith({ source: 'builtin' }))
    ).toEqual({ status: 'builtin' });
  });

  it('resolves the overlay widget', () => {
    expect(
      resolveGantryStandings(dashboardWith({ source: 'overlay' }))
    ).toEqual({ status: 'ready', source: 'overlay', widget: overlay });
  });

  it('falls back to the built-in view when the overlay widget is gone', () => {
    expect(
      resolveGantryStandings(dashboardWith({ source: 'overlay' }, []))
    ).toEqual({ status: 'builtin' });
  });

  it('resolves a Gantry-only layout', () => {
    expect(
      resolveGantryStandings(
        dashboardWith({ source: 'gantry', widgetId: 'standings-g1' })
      )
    ).toEqual({ status: 'ready', source: 'gantry', widget: gantryLayout });
  });

  it('reports a missing or unlinked Gantry-only layout', () => {
    expect(
      resolveGantryStandings(
        dashboardWith({ source: 'gantry', widgetId: 'standings-zz' })
      )
    ).toEqual({ status: 'removed', source: 'gantry' });
    expect(resolveGantryStandings(dashboardWith({ source: 'gantry' }))).toEqual(
      { status: 'unlinked', source: 'gantry' }
    );
  });

  it('does not accept the overlay widget as the Gantry-only layout', () => {
    expect(
      resolveGantryStandings(
        dashboardWith({ source: 'gantry', widgetId: 'standings' })
      )
    ).toEqual({ status: 'removed', source: 'gantry' });
  });
});
