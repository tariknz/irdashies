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
    // Default mock implementation to return null (no dashboards)
    mockReadData.mockReturnValue(null);
  });

  describe('createDefaultDashboardIfNotExists', () => {
    it('should create default dashboard if none exists', () => {
      getOrCreateDefaultDashboard();

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: defaultDashboard,
      });
    });

    it('should not create default dashboard if one already exists', () => {
      mockReadData.mockReturnValue({
        default: defaultDashboard,
      });

      getOrCreateDefaultDashboard();

      expect(mockWriteData).not.toHaveBeenCalled();
    });
  });

  describe('listDashboards', () => {
    it('should return an empty object if no dashboards exist', () => {
      mockReadData.mockReturnValue(null);

      const dashboards = listDashboards();

      expect(dashboards).toEqual({});
    });

    it('should return existing dashboards', () => {
      const dashboardsData = { default: defaultDashboard };
      mockReadData.mockReturnValue(dashboardsData);

      const dashboards = listDashboards();

      expect(dashboards).toEqual(dashboardsData);
    });
  });

  describe('getDashboard', () => {
    it('should return null if no dashboards exist', () => {
      mockReadData.mockReturnValue(null);

      const dashboard = getDashboard('default');

      expect(dashboard).toBeNull();
    });

    it('should return the requested dashboard if it exists', () => {
      const dashboardsData = { default: defaultDashboard };
      mockReadData.mockReturnValue(dashboardsData);

      const dashboard = getDashboard('default');

      expect(dashboard).toEqual(defaultDashboard);
    });
  });

  describe('saveDashboard', () => {
    it('should save a new dashboard', () => {
      const newDashboard: DashboardLayout = { widgets: [], generalSettings: { fontSize: 'sm' }};
      mockReadData.mockReturnValue(null);

      saveDashboard('newDashboard', newDashboard);

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        newDashboard,
      });
    });

    it('should update an existing dashboard', () => {
      const existingDashboards = { default: defaultDashboard };
      const updatedDashboard: DashboardLayout = { widgets: [], generalSettings: { fontSize: 'lg' }};
      mockReadData.mockReturnValue(existingDashboards);

      saveDashboard('default', updatedDashboard);

      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: updatedDashboard,
      });
    });
  });

  describe('updateDashboardWidget', () => {
    it('should throw an error if the default dashboard does not exist', () => {
      mockReadData.mockReturnValue(null);

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
      mockReadData.mockReturnValue({
        default: existingDashboard,
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
      mockReadData.mockReturnValue({
        custom: existingDashboard,
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
      mockReadData.mockReturnValue({
        default: existingDashboard,
      });

      updateDashboardWidget(updatedWidget);

      expect(mockWriteData).not.toHaveBeenCalledWith();
    });
  });

  describe('getOrCreateDefaultDashboard', () => {
    it('should return the default dashboard if it exists', () => {
      mockReadData.mockReturnValue({
        default: defaultDashboard,
      });

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard).toEqual(defaultDashboard);
    });

    it('should create and return the default dashboard if it does not exist', () => {
      mockReadData.mockReturnValue(null);

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
      mockReadData.mockReturnValue({
        default: incompleteDashboard,
      });

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard.widgets).toEqual(defaultDashboard.widgets);
      expect(mockWriteData).toHaveBeenCalledWith('dashboards', {
        default: defaultDashboard,
      });
    });

    it('should not modify the default dashboard if all widgets are present', () => {
      const completeDashboard = { ...defaultDashboard };
      mockReadData.mockReturnValue({
        default: completeDashboard,
      });

      const dashboard = getOrCreateDefaultDashboard();

      expect(dashboard).toEqual(completeDashboard);
      expect(mockWriteData).not.toHaveBeenCalled();
    });
  });

  describe('generalSettings', () => {
    it('should add general settings from the default dashboard if none exist', () => {
      const dashboard: DashboardLayout = { widgets: [] };
      mockReadData.mockReturnValue({
        default: dashboard,
      });

      const updatedDashboard = getOrCreateDefaultDashboard();

      expect(updatedDashboard.generalSettings).toEqual({ fontSize: 'sm' });
    });

    it('should preserve general settings from the existing dashboard', () => {
      const dashboard: DashboardLayout = { widgets: [], generalSettings: { fontSize: 'lg' } };
      mockReadData.mockReturnValue({
        default: dashboard,
      });
      
      const updatedDashboard = getOrCreateDefaultDashboard();

      expect(updatedDashboard.generalSettings).toEqual({ fontSize: 'lg' });
    });
  });
});
