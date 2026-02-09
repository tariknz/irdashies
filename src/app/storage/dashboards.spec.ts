import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOrCreateDefaultDashboard,
  listDashboards,
  getDashboard,
  saveDashboard,
  updateDashboardWidget,
} from './dashboards';
import { defaultDashboard } from './defaultDashboard';
import { DashboardLayout } from '@irdashies/types';

const mockReadData = vi.hoisted(() => vi.fn());
const mockWriteData = vi.hoisted(() => vi.fn());

vi.mock('./storage', () => ({
  readData: mockReadData,
  writeData: mockWriteData,
}));

describe('dashboards', () => {
  beforeEach(() => {
    mockReadData.mockReset();
    mockWriteData.mockReset();
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
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
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
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
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
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
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
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return dashboardsData;
        return null;
      });

      const dashboard = getDashboard('default');

      expect(dashboard).toEqual(defaultDashboard);
    });
  });

  describe('saveDashboard', () => {
    it('should save a new dashboard', () => {
      const newDashboard: DashboardLayout = { widgets: [], generalSettings: { fontSize: 'sm' }};
      // Use default mockImplementation which returns null for 'dashboards' key

      saveDashboard('newDashboard', newDashboard);

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        newDashboard,
      });
    });

  it('should update an existing dashboard and preserve other dashboards', () => {
    const customDashboard: DashboardLayout = { widgets: [], generalSettings: { fontSize: 'xl' }};
    const existingDashboards = { 
      default: defaultDashboard,
      custom: customDashboard,
    };
    const updatedDashboard: DashboardLayout = { widgets: [], generalSettings: { fontSize: 'lg', colorPalette: 'black' }};
    mockReadData.mockImplementation((key: string) => {
      if (key === 'currentProfile') return 'default';
      if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
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
      const existingDashboard: DashboardLayout = { widgets: [existingWidget], generalSettings: { fontSize: 'sm' } };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: existingDashboard };
        return null;
      });

      updateDashboardWidget(updatedWidget);

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: { widgets: [updatedWidget], generalSettings: { fontSize: 'sm' } },
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
      const existingDashboard: DashboardLayout = { widgets: [existingWidget], generalSettings: { fontSize: 'sm' } };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { custom: existingDashboard };
        return null;
      });

      updateDashboardWidget(updatedWidget, 'custom');

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        custom: { widgets: [updatedWidget], generalSettings: { fontSize: 'sm' } },
      });
    });

    it('should not update a widget if it does not exist in the dashboard', () => {
      const updatedWidget = {
        id: 'input',
        enabled: true,
        layout: { x: 100, y: 100, width: 600, height: 120 },
      };
      const existingDashboard: DashboardLayout = { widgets: [], generalSettings: { fontSize: 'sm' } };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
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
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
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
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
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
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: completeDashboard };
        return null;
      });

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard).toEqual(completeDashboard);
      expect(mockWriteData).not.toHaveBeenCalled();
    });
  });

  describe('generalSettings', () => {
    it('should add general settings from the default dashboard if none exist', () => {
      const dashboard: DashboardLayout = { widgets: [] };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: dashboard };
        return null;
      });

      const updatedDashboard = getOrCreateDefaultDashboard();

      expect(updatedDashboard.generalSettings).toEqual(defaultDashboard.generalSettings);
    });

    it('should preserve general settings from the existing dashboard', () => {
      const dashboard: DashboardLayout = { widgets: [], generalSettings: { fontSize: 'sm' } };
      mockReadData.mockImplementation((key: string) => {
        if (key === 'currentProfile') return 'default';
        if (key === 'profiles') return { default: { id: 'default', name: 'Default' } };
        if (key === 'dashboards') return { default: dashboard };
        return null;
      });
      
      const updatedDashboard = getOrCreateDefaultDashboard();

      expect(updatedDashboard.generalSettings).toEqual({ ...defaultDashboard.generalSettings, fontSize: 'sm' });
    });
  });

  describe('defaultDashboard widgets', () => {
    it('should have showOnlyWhenOnTrack property in Track Map widget', () => {
      const mapWidget = defaultDashboard.widgets.find((w) => w.id === 'map');

      expect(mapWidget).toBeDefined();
      expect((mapWidget?.config as Record<string, unknown>)?.showOnlyWhenOnTrack).toBe(false);
    });

    it('should have showOnlyWhenOnTrack property in Flat Track Map widget', () => {
      const flatMapWidget = defaultDashboard.widgets.find((w) => w.id === 'flatmap');

      expect(flatMapWidget).toBeDefined();
      expect((flatMapWidget?.config as Record<string, unknown>)?.showOnlyWhenOnTrack).toBe(false);
    });
  });
});
