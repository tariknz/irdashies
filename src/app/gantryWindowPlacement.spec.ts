import { describe, expect, it } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import {
  readGantryWindowPlacement,
  withGantryWindowPlacement,
} from './gantryWindowPlacement';

const dashboard = (window?: Record<string, unknown>): DashboardLayout =>
  ({
    widgets: [
      { id: 'standings', enabled: true, config: {} },
      {
        id: 'gantry',
        enabled: true,
        config: { speedUnit: 'auto', ...(window ? { window } : {}) },
      },
    ],
  }) as unknown as DashboardLayout;

const gantryWindow = (layout: DashboardLayout | null) =>
  (
    layout?.widgets.find((widget) => widget.id === 'gantry')?.config as {
      window?: Record<string, unknown>;
    }
  )?.window;

const BOUNDS = { x: 2000, y: 120, width: 1300, height: 760 };

describe('readGantryWindowPlacement', () => {
  it('reads the saved bounds and maximised state', () => {
    expect(
      readGantryWindowPlacement(
        dashboard({ alwaysOnTop: false, bounds: BOUNDS, maximized: true })
      )
    ).toEqual({ bounds: BOUNDS, maximized: true });
  });

  it('reads nothing saved for a dashboard that has none', () => {
    expect(readGantryWindowPlacement(dashboard())).toEqual({
      bounds: undefined,
      maximized: false,
    });
    expect(readGantryWindowPlacement(undefined)).toEqual({
      bounds: undefined,
      maximized: false,
    });
  });
});

describe('withGantryWindowPlacement', () => {
  it('saves the placement and keeps the other window settings', () => {
    const updated = withGantryWindowPlacement(
      dashboard({ alwaysOnTop: true }),
      { bounds: BOUNDS, maximized: false }
    );

    expect(gantryWindow(updated)).toEqual({
      alwaysOnTop: true,
      bounds: BOUNDS,
      maximized: false,
    });
    expect(updated?.widgets[0]).toEqual({
      id: 'standings',
      enabled: true,
      config: {},
    });
  });

  it('rounds fractional bounds from scaled displays', () => {
    const updated = withGantryWindowPlacement(dashboard(), {
      bounds: { x: 2000.4, y: 119.6, width: 1300.5, height: 760.2 },
      maximized: false,
    });

    expect(gantryWindow(updated)).toMatchObject({
      alwaysOnTop: false,
      bounds: { x: 2000, y: 120, width: 1301, height: 760 },
    });
  });

  it('returns null when nothing has changed, so nothing is saved', () => {
    expect(
      withGantryWindowPlacement(
        dashboard({ alwaysOnTop: false, bounds: BOUNDS, maximized: false }),
        { bounds: BOUNDS, maximized: false }
      )
    ).toBeNull();
  });

  it('saves a change to the maximised state alone', () => {
    const updated = withGantryWindowPlacement(
      dashboard({ alwaysOnTop: false, bounds: BOUNDS, maximized: false }),
      { bounds: BOUNDS, maximized: true }
    );

    expect(gantryWindow(updated)?.maximized).toBe(true);
  });

  it('replaces a malformed window block rather than spreading it', () => {
    const malformed = dashboard();
    (malformed.widgets[1].config as Record<string, unknown>).window = 'yes';

    const updated = withGantryWindowPlacement(malformed, {
      bounds: BOUNDS,
      maximized: false,
    });

    expect(gantryWindow(updated)).toEqual({
      alwaysOnTop: false,
      bounds: BOUNDS,
      maximized: false,
    });
    expect(readGantryWindowPlacement(malformed)).toEqual({
      bounds: undefined,
      maximized: false,
    });
  });

  it('ignores a dashboard without the Gantry and invalid bounds', () => {
    const noGantry = { widgets: [] } as unknown as DashboardLayout;
    expect(
      withGantryWindowPlacement(noGantry, { bounds: BOUNDS, maximized: false })
    ).toBeNull();
    expect(
      withGantryWindowPlacement(dashboard(), {
        bounds: { x: 0, y: 0, width: 0, height: 760 },
        maximized: false,
      })
    ).toBeNull();
  });
});
