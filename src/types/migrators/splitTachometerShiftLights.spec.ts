import { describe, expect, it } from 'vitest';
import type { DashboardLayout } from '../dashboardLayout';
import { migrateSplitTachometerShiftLights } from './splitTachometerShiftLights';

const legacyDashboard = (
  orientation: 'horizontal' | 'top' | 'bottom' = 'horizontal'
): DashboardLayout => ({
  widgets: [
    {
      id: 'tachometer',
      enabled: true,
      layout: { x: -500, y: 100, width: 496, height: 50 },
      config: {
        showRpmText: false,
        rpmOrientation: orientation,
        background: { opacity: 60 },
        showOnlyWhenOnTrack: false,
        sessionVisibility: { race: true },
        shiftPointSettings: {
          enabled: true,
          indicatorType: 'pulse',
          indicatorColor: '#123456',
          carConfigs: {
            testcar: {
              enabled: false,
              carId: 'testcar',
              carName: 'Test Car',
              gearCount: 2,
              redlineRpm: 8000,
              gearShiftPoints: { '1': { shiftRpm: 7000 } },
            },
          },
        },
      },
    },
  ],
});

describe('migrateSplitTachometerShiftLights', () => {
  it('moves shift settings into an independently placed widget', () => {
    const result = migrateSplitTachometerShiftLights(legacyDashboard());
    const tachometer = result.dashboard.widgets[0];
    const shiftLights = result.dashboard.widgets[1];

    expect(result.changed).toBe(true);
    expect(shiftLights).toMatchObject({
      id: 'shiftlights',
      enabled: true,
      layout: { x: -500, y: 100, width: 496, height: 50 },
      config: {
        version: 1,
        background: { opacity: 60 },
        showOnlyWhenOnTrack: false,
        shiftPointSettings: {
          enabled: true,
          carConfigs: { testcar: { enabled: false } },
        },
      },
    });
    expect(tachometer.config).toMatchObject({
      version: 2,
      showRpmText: false,
    });
    expect(tachometer.config).not.toHaveProperty('shiftPointSettings');
    expect(tachometer.layout).toEqual({
      x: -500,
      y: 100,
      width: 496,
      height: 50,
    });
    expect(tachometer.config).toHaveProperty('rpmOrientation', 'horizontal');
  });

  it.each(['top', 'bottom'] as const)(
    'preserves the tachometer layout and %s RPM orientation',
    (value) => {
      const result = migrateSplitTachometerShiftLights(legacyDashboard(value));
      expect(result.dashboard.widgets[0].layout).toEqual({
        x: -500,
        y: 100,
        width: 496,
        height: 50,
      });
      expect(result.dashboard.widgets[0].config).toHaveProperty(
        'rpmOrientation',
        value
      );
    }
  );

  it('falls back for invalid saved shift settings', () => {
    const dashboard = legacyDashboard();
    dashboard.widgets[0].config = {
      ...dashboard.widgets[0].config,
      shiftPointSettings: { enabled: 'yes' },
    };
    const result = migrateSplitTachometerShiftLights(dashboard);

    expect(result.invalidShiftPointSettings).toBe(true);
    expect(
      result.dashboard.widgets[1].config?.shiftPointSettings
    ).toMatchObject({
      enabled: false,
      carConfigs: {},
    });
  });

  it('does not overwrite an existing Shift Lights widget', () => {
    const dashboard = legacyDashboard();
    dashboard.widgets.push({
      id: 'shiftlights',
      enabled: false,
      layout: { x: 10, y: 20, width: 300, height: 40 },
      config: { version: 1, marker: 'keep' },
    });
    const result = migrateSplitTachometerShiftLights(dashboard);

    expect(result.dashboard.widgets).toHaveLength(2);
    expect(result.dashboard.widgets[1].config).toEqual({
      version: 1,
      marker: 'keep',
    });
    expect(result.dashboard.widgets[0].config).not.toHaveProperty(
      'shiftPointSettings'
    );
  });

  it('is idempotent', () => {
    const first = migrateSplitTachometerShiftLights(legacyDashboard());
    const second = migrateSplitTachometerShiftLights(first.dashboard);

    expect(second.changed).toBe(false);
    expect(second.dashboard).toEqual(first.dashboard);
  });

  it('uses deterministic ids for custom tachometer instances', () => {
    const dashboard = legacyDashboard();
    dashboard.widgets[0] = {
      ...dashboard.widgets[0],
      id: 'tachometer-left',
      type: 'tachometer',
    };
    const result = migrateSplitTachometerShiftLights(dashboard);

    expect(result.dashboard.widgets[1]).toMatchObject({
      id: 'tachometer-left-shiftlights',
      type: 'shiftlights',
    });
  });
});
