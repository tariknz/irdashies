import { describe, expect, it } from 'vitest';
import {
  getWidgetDefaultConfig,
  resolveGantryStandings,
  type DashboardLayout,
} from '@irdashies/types';
import {
  copyOverlayToGantryStandings,
  createGantryStandingsLayout,
  deleteGantryStandingsLayout,
  readGantryStandings,
} from './gantryStandingsEdits';

const layout = { x: 0, y: 0, width: 100, height: 100 };

const dashboard = (): DashboardLayout => ({
  widgets: [
    {
      id: 'gantry',
      enabled: true,
      layout,
      config: { standings: { source: 'builtin' }, speedUnit: 'mph' },
    },
    {
      id: 'standings',
      enabled: true,
      layout,
      scale: 120,
      config: {
        ...getWidgetDefaultConfig('standings'),
        showOnlyWhenOnTrack: true,
        background: { opacity: 33 },
      },
    },
  ],
});

const find = (d: DashboardLayout, id: string) =>
  d.widgets.find((w) => w.id === id);

describe('createGantryStandingsLayout', () => {
  it('adds a Gantry-only copy of the overlay and points the Gantry at it', () => {
    const next = createGantryStandingsLayout(dashboard(), 'standings-g1');

    expect(find(next, 'standings-g1')).toMatchObject({
      type: 'standings',
      placement: 'gantry',
      enabled: true,
      scale: 120,
    });
    expect(find(next, 'standings-g1')?.config).toMatchObject({
      background: { opacity: 33 },
      showOnlyWhenOnTrack: false,
      driverStandings: { showAll: true },
    });
    expect(readGantryStandings(next)).toEqual({
      source: 'gantry',
      widgetId: 'standings-g1',
    });
    expect(find(next, 'gantry')?.config?.speedUnit).toBe('mph');
    expect(resolveGantryStandings(next).status).toBe('ready');
  });

  it('does not touch or share state with the overlay widget', () => {
    const base = dashboard();
    const next = createGantryStandingsLayout(base, 'standings-g1');

    expect(find(next, 'standings')).toEqual(find(base, 'standings'));
    const copy = find(next, 'standings-g1')?.config as Record<string, unknown>;
    const overlay = find(base, 'standings')?.config as Record<string, unknown>;
    expect(copy.displayOrder).not.toBe(overlay.displayOrder);
  });
});

describe('copyOverlayToGantryStandings', () => {
  it('overwrites the layout but keeps its own show-all choice', () => {
    const created = createGantryStandingsLayout(dashboard(), 'standings-g1');
    const edited: DashboardLayout = {
      ...created,
      widgets: created.widgets.map((w) => {
        if (w.id === 'standings-g1') {
          return {
            ...w,
            config: {
              ...w.config,
              background: { opacity: 5 },
              driverStandings: { showAll: false },
            },
          };
        }
        if (w.id === 'standings') {
          return {
            ...w,
            config: { ...w.config, background: { opacity: 77 } },
          };
        }
        return w;
      }),
    };

    const next = copyOverlayToGantryStandings(edited, 'standings-g1');
    expect(find(next, 'standings-g1')?.config).toMatchObject({
      background: { opacity: 77 },
      showOnlyWhenOnTrack: false,
      driverStandings: { showAll: false },
    });
  });

  it('leaves the overlay widget alone', () => {
    const created = createGantryStandingsLayout(dashboard(), 'standings-g1');
    expect(copyOverlayToGantryStandings(created, 'standings').widgets).toEqual(
      created.widgets
    );
  });
});

describe('deleteGantryStandingsLayout', () => {
  it('removes the layout and returns the Gantry to the built-in view', () => {
    const created = createGantryStandingsLayout(dashboard(), 'standings-g1');
    const next = deleteGantryStandingsLayout(created, 'standings-g1');
    expect(find(next, 'standings-g1')).toBeUndefined();
    expect(readGantryStandings(next)).toEqual({ source: 'builtin' });
  });

  it('never deletes the overlay Standings widget', () => {
    const base = dashboard();
    expect(
      find(deleteGantryStandingsLayout(base, 'standings'), 'standings')
    ).toEqual(find(base, 'standings'));
  });
});
