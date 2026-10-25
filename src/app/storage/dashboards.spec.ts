import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  applyDefaultsToAllProfiles,
  getOrCreateDefaultDashboard,
  setCurrentProfile,
  listDashboards,
  getDashboard,
  saveDashboard,
  updateDashboardWidget,
  withDashboardDefaults,
  resetDashboard,
} from './dashboards';
import { defaultDashboard } from '@irdashies/types';
import { DashboardLayout } from '@irdashies/types';

const mockReadData = vi.hoisted(() => vi.fn());
const mockWriteData = vi.hoisted(() => vi.fn());

vi.mock('./storage', () => ({
  readData: mockReadData,
  writeData: mockWriteData,
}));

const mockLoggerWarn = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockEmitDashboardUpdated = vi.hoisted(() => vi.fn());

vi.mock('./dashboardEvents', () => ({
  emitDashboardUpdated: mockEmitDashboardUpdated,
}));

describe('dashboards', () => {
  beforeEach(() => {
    mockReadData.mockReset();
    mockWriteData.mockReset();
    mockEmitDashboardUpdated.mockReset();
    mockLoggerWarn.mockReset();
    // Setup intelligent mock for readData that handles different keys
    mockReadData.mockImplementation((key: string) => {
      if (key === 'currentProfile') {
        return 'default'; // Always return 'default' as current profile for tests
      }
      if (key === 'profiles') {
        return { default: { id: 'default', name: 'Default' } }; // Default profile exists
      }
      // For 'dashboards' key and others, return null by default
      return null;
    });
  });

  describe('createDefaultDashboardIfNotExists', () => {
    it('should create default dashboard if none exists', () => {
      // Mock readData to return null for dashboards, but 'default' for currentProfile
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        return null; // No dashboards exist
      });

      getOrCreateDefaultDashboard();

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: defaultDashboard,
      });
    });

    it('should not create default dashboard if one already exists', () => {
      // Mock readData to return existing dashboard for 'dashboards' key
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: defaultDashboard };
        return null;
      });

      getOrCreateDefaultDashboard();

      expect(mockWriteData).not.toHaveBeenCalled();
    });
  });

  describe('listDashboards', () => {
    it('should return an empty object if no dashboards exist', () => {
      // Use default mockImplementation which returns null for 'dashboards' key

      const dashboards = listDashboards();

      expect(dashboards).toEqual({});
    });

    it('should return existing dashboards', () => {
      const dashboardsData = { default: defaultDashboard };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return dashboardsData;
        return null;
      });

      const dashboards = listDashboards();

      expect(dashboards).toEqual(dashboardsData);
    });
  });

  describe('getDashboard', () => {
    it('should return null if no dashboards exist', () => {
      // Use default mockImplementation which returns null for 'dashboards' key

      const dashboard = getDashboard('default');

      expect(dashboard).toBeNull();
    });

    it('should return the requested dashboard if it exists', () => {
      const dashboardsData = { default: defaultDashboard };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return dashboardsData;
        return null;
      });

      const dashboard = getDashboard('default');

      expect(dashboard).toEqual(defaultDashboard);
    });
  });

  describe('saveDashboard', () => {
    it('should save a new dashboard', () => {
      const newDashboard: DashboardLayout = {
        widgets: [],
        generalSettings: { fontSize: 'sm' },
      };
      // Use default mockImplementation which returns null for 'dashboards' key

      saveDashboard('newDashboard', newDashboard);

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        newDashboard,
      });
    });

    it('should update an existing dashboard and preserve other dashboards', () => {
      const customDashboard: DashboardLayout = {
        widgets: [],
        generalSettings: { fontSize: 'xl' },
      };
      const existingDashboards = {
        default: defaultDashboard,
        custom: customDashboard,
      };
      const updatedDashboard: DashboardLayout = {
        widgets: [],
        generalSettings: { fontSize: 'lg', colorPalette: 'black' },
      };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return existingDashboards;
        return null;
      });

      saveDashboard('default', updatedDashboard);

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: {
          ...defaultDashboard,
          ...updatedDashboard,
          generalSettings: {
            ...defaultDashboard.generalSettings,
            ...updatedDashboard.generalSettings,
          },
        },
        custom: customDashboard,
      });
    });
  });

  describe('updateDashboardWidget', () => {
    it('should throw an error if the default dashboard does not exist', () => {
      // Use default mockImplementation which returns null for 'dashboards' key

      const updatedWidget = {
        id: 'input',
        enabled: true,
        layout: { x: 100, y: 100, width: 600, height: 120 },
      };

      expect(() => updateDashboardWidget(updatedWidget)).toThrow(
        'Default dashboard not found'
      );
    });

    it('should update an existing widget in the default dashboard', () => {
      const existingWidget = {
        id: 'input',
        enabled: true,
        layout: { x: 0, y: 0, width: 300, height: 100 },
      };
      const updatedWidget = {
        id: 'input',
        enabled: false,
        layout: { x: 100, y: 100, width: 600, height: 120 },
      };
      const existingDashboard: DashboardLayout = {
        widgets: [existingWidget],
        generalSettings: { fontSize: 'sm' },
      };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: existingDashboard };
        return null;
      });

      updateDashboardWidget(updatedWidget);

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: {
          widgets: [updatedWidget],
          generalSettings: { fontSize: 'sm' },
        },
      });
    });

    it('should update an existing widget in a specific dashboard', () => {
      const existingWidget = {
        id: 'input',
        enabled: true,
        layout: { x: 0, y: 0, width: 300, height: 100 },
      };
      const updatedWidget = {
        id: 'input',
        enabled: true,
        layout: { x: 100, y: 100, width: 600, height: 120 },
      };
      const existingDashboard: DashboardLayout = {
        widgets: [existingWidget],
        generalSettings: { fontSize: 'sm' },
      };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { custom: existingDashboard };
        return null;
      });

      updateDashboardWidget(updatedWidget, 'custom');

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        custom: {
          widgets: [updatedWidget],
          generalSettings: { fontSize: 'sm' },
        },
      });
    });

    it('should not update a widget if it does not exist in the dashboard', () => {
      const updatedWidget = {
        id: 'input',
        enabled: true,
        layout: { x: 100, y: 100, width: 600, height: 120 },
      };
      const existingDashboard: DashboardLayout = {
        widgets: [],
        generalSettings: { fontSize: 'sm' },
      };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: existingDashboard };
        return null;
      });

      updateDashboardWidget(updatedWidget);

      expect(mockWriteData).not.toHaveBeenCalledWith();
    });
  });

  describe('getOrCreateDefaultDashboard', () => {
    it('should return the default dashboard if it exists', () => {
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: defaultDashboard };
        return null;
      });

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard).toEqual(defaultDashboard);
    });

    it('should create and return the default dashboard if it does not exist', () => {
      // Use default mockImplementation which returns null for 'dashboards' key

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard).toEqual(defaultDashboard);
      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: defaultDashboard,
      });
    });

    it('should add missing widgets to the default dashboard if some widgets are missing', () => {
      const incompleteDashboard = {
        generalSettings: { fontSize: 'sm' },
        widgets: defaultDashboard.widgets.slice(0, 1),
      };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: incompleteDashboard };
        return null;
      });

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard.widgets).toEqual(defaultDashboard.widgets);
      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: defaultDashboard,
      });
    });

    it('should not modify the default dashboard if all widgets are present', () => {
      const completeDashboard = { ...defaultDashboard };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: completeDashboard };
        return null;
      });

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard).toEqual(completeDashboard);
      expect(mockWriteData).not.toHaveBeenCalled();
    });
  });

  describe('active dashboard without widgets', () => {
    it('loads it with the default widgets instead of throwing', () => {
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards')
          return {
            default: { generalSettings: defaultDashboard.generalSettings },
          };
        return null;
      });

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard.widgets.map((w) => w.id)).toEqual(
        defaultDashboard.widgets.map((w) => w.id)
      );
      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: dashboard,
      });
    });
  });

  describe('applyDefaultsToAllProfiles', () => {
    it('fills in config values for profiles other than the active one', () => {
      const stored: Record<string, DashboardLayout> = {
        default: defaultDashboard,
        race: {
          ...defaultDashboard,
          widgets: defaultDashboard.widgets.map((w) =>
            w.id === 'tachometer'
              ? { ...w, config: { background: { opacity: 40 } } }
              : w
          ),
        },
      };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return {
            default: { id: 'default', name: 'Default' },
            race: { id: 'race', name: 'Race' },
            empty: { id: 'empty', name: 'No dashboard yet' },
          };
        if (key === 'dashboards') return stored;
        return null;
      });

      applyDefaultsToAllProfiles();

      const [, written] = mockWriteData.mock.calls.find(
        ([key, value]) => key === 'dashboards' && value.race
      ) as [string, Record<string, DashboardLayout>];
      const tachometer = written.race.widgets.find(
        (w) => w.id === 'tachometer'
      );
      const defaults = defaultDashboard.widgets.find(
        (w) => w.id === 'tachometer'
      )?.config as Record<string, unknown>;
      expect(tachometer?.config).toEqual({
        ...defaults,
        background: { ...(defaults.background as object), opacity: 40 },
      });
      // A profile without a stored dashboard is left for first use.
      expect(written).not.toHaveProperty('empty');
    });

    it('repairs malformed inactive dashboards instead of stopping startup', () => {
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return {
            default: { id: 'default', name: 'Default' },
            broken: { id: 'broken', name: 'Broken' },
            nulls: { id: 'nulls', name: 'Null widget' },
            gone: null,
          };
        if (key === 'dashboards')
          return {
            default: defaultDashboard,
            broken: {},
            nulls: { ...defaultDashboard, widgets: [null] },
          };
        return null;
      });

      expect(() => applyDefaultsToAllProfiles()).not.toThrow();

      // One write for every inactive profile; bad entries fall back to the
      // defaults (R8.3) instead of leaving the whole profile unmigrated.
      expect(mockWriteData).toHaveBeenCalledOnce();
      const [key, written] = mockWriteData.mock.calls[0] as [
        string,
        Record<string, DashboardLayout>,
      ];
      expect(key).toBe('dashboards');
      expect(written.broken.widgets.map((w) => w.id)).toEqual(
        defaultDashboard.widgets.map((w) => w.id)
      );
      expect(written.nulls.widgets).not.toContain(null);
      expect(written.nulls.widgets).toHaveLength(
        defaultDashboard.widgets.length
      );
    });

    it('repairs a stored widget from its defaults and keeps the rest', () => {
      const instanceLayout = { x: 10, y: 20, width: 300, height: 200 };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return {
            default: { id: 'default', name: 'Default' },
            race: { id: 'race', name: 'Race' },
          };
        if (key === 'dashboards')
          return {
            default: defaultDashboard,
            race: {
              ...defaultDashboard,
              widgets: [
                ...defaultDashboard.widgets.map((w) =>
                  w.id === 'tachometer'
                    ? {
                        id: 'tachometer',
                        layout: {},
                        config: { background: { opacity: 40 } },
                      }
                    : w
                ),
                {
                  id: 'standings-2',
                  type: 'standings',
                  layout: instanceLayout,
                },
                {
                  id: 'standings-3',
                  type: 'standings',
                  enabled: true,
                  layout: { x: 0, y: 0, width: -300, height: 0 },
                },
                {
                  id: 'fuel-2',
                  type: 5,
                  enabled: true,
                  layout: instanceLayout,
                },
                { id: 'unknown', enabled: true },
              ],
            },
          };
        return null;
      });

      applyDefaultsToAllProfiles();

      const [, written] = mockWriteData.mock.calls[0] as [
        string,
        Record<string, DashboardLayout>,
      ];
      const byId = (id: string) =>
        written.race.widgets.find((w) => w.id === id);
      const defaultOf = (id: string) =>
        defaultDashboard.widgets.find((w) => w.id === id);

      expect(byId('tachometer')?.layout).toEqual(
        defaultOf('tachometer')?.layout
      );
      // A missing `enabled` stays off, as it was read before.
      expect(byId('tachometer')?.enabled).toBe(false);
      expect(byId('tachometer')?.config?.background).toMatchObject({
        opacity: 40,
      });
      // An extra instance keeps its own layout.
      expect(byId('standings-2')?.layout).toEqual(instanceLayout);
      expect(byId('standings-2')?.enabled).toBe(false);
      // An unusable layout comes from the instance's type.
      expect(byId('standings-3')?.layout).toEqual(
        defaultOf('standings')?.layout
      );
      expect(byId('standings-3')?.enabled).toBe(true);
      // A type that isn't a string is dropped.
      expect(byId('fuel-2')).not.toHaveProperty('type');
      // Nothing to fall back on for the layout.
      expect(byId('unknown')).toBeUndefined();
      // Both the drop and the repair are logged.
      const warned = mockLoggerWarn.mock.calls.map(([message, id]) => [
        message,
        id,
      ]);
      expect(warned).toContainEqual([
        '[toStoredWidget] Dropped widget with no usable layout:',
        'unknown',
      ]);
      expect(warned).toContainEqual([
        '[toStoredWidget] Replaced an invalid layout with the default for:',
        'tachometer',
      ]);
    });

    it('never throws on unreadable stored data', () => {
      mockReadData.mockImplementation(() => {
        throw new Error('corrupt store');
      });
      expect(() => applyDefaultsToAllProfiles()).not.toThrow();
    });
  });

  describe('setCurrentProfile', () => {
    it('fills in the stored dashboard before emitting it', () => {
      const stored: Record<string, DashboardLayout> = {
        default: defaultDashboard,
        race: {
          ...defaultDashboard,
          widgets: defaultDashboard.widgets.map((w) =>
            w.id === 'tachometer'
              ? { ...w, config: { background: { opacity: 40 } } }
              : w
          ),
        },
      };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return {
            default: { id: 'default', name: 'Default' },
            race: { id: 'race', name: 'Race' },
          };
        if (key === 'dashboards') return stored;
        return null;
      });

      setCurrentProfile('race');

      const defaults = defaultDashboard.widgets.find(
        (w) => w.id === 'tachometer'
      )?.config as Record<string, unknown>;
      expect(mockEmitDashboardUpdated).toHaveBeenCalledOnce();
      const [emitted] = mockEmitDashboardUpdated.mock.calls[0] as [
        DashboardLayout,
      ];
      expect(
        emitted.widgets.find((w) => w.id === 'tachometer')?.config
      ).toEqual({
        ...defaults,
        background: { ...(defaults.background as object), opacity: 40 },
      });
      expect(mockWriteData).toHaveBeenCalledWith('currentProfile', 'race');
    });
  });

  describe('configuration reset', () => {
    it('resets shared scales, including migrated standings and custom instances, while preserving the layout', () => {
      const layout = { x: 20, y: 40, width: 400, height: 300 };
      const dashboard = withDashboardDefaults({
        widgets: [
          {
            id: 'standings',
            enabled: false,
            layout,
            config: { scale: 125, background: { opacity: 40 } },
          },
          {
            id: 'fuel-2',
            type: 'fuel',
            enabled: true,
            placement: 'gantry',
            layout: { ...layout, x: 100 },
            scale: 75,
            config: {},
          },
        ],
      });
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'race';
        if (key === 'dashboards') return { race: dashboard };
        return null;
      });

      const reset = resetDashboard(false, 'race');

      expect(reset.widgets.every((widget) => widget.scale === 100)).toBe(true);
      expect(reset.widgets[0]).toMatchObject({
        id: 'standings',
        enabled: false,
        layout,
      });
      expect(reset.widgets[0].config).toEqual(
        defaultDashboard.widgets.find((widget) => widget.id === 'standings')
          ?.config
      );
      expect(reset.widgets[1]).toMatchObject({
        id: 'fuel-2',
        type: 'fuel',
        enabled: true,
        placement: 'gantry',
        layout: { ...layout, x: 100 },
        scale: 100,
      });
      expect(dashboard.widgets[0].scale).toBe(125);
      expect(dashboard.widgets[1].scale).toBe(75);
      expect(mockWriteData).toHaveBeenCalledWith('dashboards', { race: reset });
    });
  });

  describe('widget scale migration', () => {
    const layout = { x: 20, y: 40, width: 400, height: 300 };

    it('moves standings scales, including custom instances, without mutating saved data', () => {
      const dashboard: DashboardLayout = {
        widgets: [
          { id: 'standings', enabled: true, layout, config: { scale: 125 } },
          {
            id: 'standings-2',
            type: 'standings',
            enabled: true,
            layout,
            config: { scale: 75, background: { opacity: 40 } },
          },
          { id: 'laptimelog', enabled: true, layout, config: { scale: 150 } },
        ],
      };
      const migrated = withDashboardDefaults(dashboard);
      expect(migrated.widgets[0].scale).toBe(125);
      expect(migrated.widgets[0].config).not.toHaveProperty('scale');
      expect(migrated.widgets[1]).toMatchObject({
        scale: 75,
        layout,
        config: { background: { opacity: 40 } },
      });
      expect(migrated.widgets[1].config).not.toHaveProperty('scale');
      expect(migrated.widgets[2].config?.scale).toBe(150);
      expect(migrated.widgets[2].scale).toBeUndefined();
      expect(dashboard.widgets[0].config?.scale).toBe(125);
      expect(withDashboardDefaults(migrated)).toEqual(migrated);
    });

    it('prefers the shared scale and normalizes malformed values', () => {
      const migrated = withDashboardDefaults({
        widgets: [
          {
            id: 'standings',
            enabled: true,
            layout,
            scale: 80,
            config: { scale: 150 },
          },
          { id: 'fuel', enabled: true, layout, scale: 1000 },
          { id: 'fuel-2', type: 'fuel', enabled: true, layout, scale: -10 },
          {
            id: 'fuel-3',
            type: 'fuel',
            enabled: true,
            layout,
            scale: '125' as unknown as number,
          },
          {
            id: 'standings-2',
            type: 'standings',
            enabled: true,
            layout,
            config: { scale: null },
          },
        ],
      });
      expect(migrated.widgets.slice(0, 5).map((w) => w.scale)).toEqual([
        80, 200, 50, 100, 100,
      ]);
    });
  });

  describe('Radar tuning migration', () => {
    it('drops the pole-side learning tuning and keeps the rest', () => {
      const radarDefaults = defaultDashboard.widgets.find(
        (w) => w.id === 'radar'
      )?.config as Record<string, unknown>;
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards')
          return {
            default: {
              ...defaultDashboard,
              widgets: defaultDashboard.widgets.map((w) =>
                w.id === 'radar'
                  ? {
                      ...w,
                      config: {
                        ...radarDefaults,
                        tuning: {
                          laneRate: 2,
                          poleLearnAfterS: 15,
                          poleFlipFrames: 30,
                        },
                      },
                    }
                  : w
              ),
            },
          };
        return null;
      });

      const tuning = getOrCreateDefaultDashboard().widgets.find(
        (w) => w.id === 'radar'
      )?.config?.tuning as Record<string, unknown>;

      expect(tuning.laneRate).toBe(2);
      expect(tuning).not.toHaveProperty('poleLearnAfterS');
      expect(tuning).not.toHaveProperty('poleFlipFrames');
      expect(tuning.gridMaxSpeedMs).toBeDefined();
    });
  });

  describe('Gantry threshold migration', () => {
    const gantryDefaults = defaultDashboard.widgets.find(
      (w) => w.id === 'gantry'
    )?.config as Record<string, number | string>;

    const dashboardWithGantryConfig = (config: Record<string, unknown>) => ({
      ...defaultDashboard,
      widgets: defaultDashboard.widgets.map((w) =>
        w.id === 'gantry' ? { ...w, config } : w
      ),
    });

    const loadWith = (config: Record<string, unknown>) => {
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards')
          return { default: dashboardWithGantryConfig(config) };
        return null;
      });
      const dashboard = getOrCreateDefaultDashboard();
      return dashboard.widgets.find((w) => w.id === 'gantry')?.config as Record<
        string,
        number | string
      >;
    };

    it('resets thresholds saved before the current version', () => {
      // A config from the frame-count era. Those values are all valid seconds,
      // so nothing rejects them — only the version marker gives them away.
      const config = loadWith({
        ...gantryDefaults,
        thresholdsVersion: undefined,
        slowDurationSeconds: 10,
        offTrackDurationSeconds: 3,
        pitEntryDurationSeconds: 3,
      });

      expect(config.thresholdsVersion).toBe(3);
      expect(config.slowDurationSeconds).toBe(
        gantryDefaults.slowDurationSeconds
      );
      expect(config.impactDecelKmhPerSec).toBe(
        gantryDefaults.impactDecelKmhPerSec
      );
      expect(config.offTrackDurationSeconds).toBe(
        gantryDefaults.offTrackDurationSeconds
      );
      expect(config.pitEntryDurationSeconds).toBe(
        gantryDefaults.pitEntryDurationSeconds
      );
    });

    it('keeps thresholds saved at the current version', () => {
      const config = loadWith({
        ...gantryDefaults,
        thresholdsVersion: 3,
        offTrackDurationSeconds: 0.8,
        slowSpeedThreshold: 25,
      });

      expect(config.offTrackDurationSeconds).toBe(0.8);
      expect(config.slowSpeedThreshold).toBe(25);
    });

    it('leaves non-threshold settings alone when resetting', () => {
      const config = loadWith({
        ...gantryDefaults,
        thresholdsVersion: undefined,
        offTrackDurationSeconds: 3,
        speedUnit: 'mph',
        sessionRetention: 10,
      });

      expect(config.speedUnit).toBe('mph');
      expect(config.sessionRetention).toBe(10);
      expect(config.offTrackDurationSeconds).toBe(
        gantryDefaults.offTrackDurationSeconds
      );
    });
  });

  describe('generalSettings', () => {
    it('should add general settings from the default dashboard if none exist', () => {
      const dashboard: DashboardLayout = { widgets: [] };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: dashboard };
        return null;
      });

      const updatedDashboard = getOrCreateDefaultDashboard();

      expect(updatedDashboard.generalSettings).toEqual(
        defaultDashboard.generalSettings
      );
    });

    it('should preserve general settings from the existing dashboard', () => {
      const dashboard: DashboardLayout = {
        widgets: [],
        generalSettings: { fontSize: 'sm' },
      };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles')
          return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: dashboard };
        return null;
      });

      const updatedDashboard = getOrCreateDefaultDashboard();

      expect(updatedDashboard.generalSettings).toEqual({
        ...defaultDashboard.generalSettings,
        fontSize: 'sm',
      });
    });
  });

  describe('defaultDashboard widgets', () => {
    it('should have showOnlyWhenOnTrack property in Track Map widget', () => {
      const mapWidget = defaultDashboard.widgets.find((w) => w.id === 'map');

      expect(mapWidget).toBeDefined();
      expect(mapWidget?.config?.showOnlyWhenOnTrack).toBe(false);
    });

    it('should have showOnlyWhenOnTrack property in Flat Track Map widget', () => {
      const flatMapWidget = defaultDashboard.widgets.find(
        (w) => w.id === 'flatmap'
      );

      expect(flatMapWidget).toBeDefined();
      expect(flatMapWidget?.config?.showOnlyWhenOnTrack).toBe(false);
    });
  });
});
