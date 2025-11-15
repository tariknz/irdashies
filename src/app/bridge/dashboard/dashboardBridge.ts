import { ipcMain } from 'electron';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';
import { onDashboardUpdated } from '../../storage/dashboardEvents';
import { getDashboard, saveDashboard, resetDashboard } from '../../storage/dashboards';
import { OverlayManager } from '../../overlayManager';

// Store callbacks for dashboard updates
const dashboardUpdateCallbacks: Set<(dashboard: DashboardLayout) => void> = new Set<(dashboard: DashboardLayout) => void>();

/**
 * Main dashboard bridge instance exposed to component server
 */
export const dashboardBridge: DashboardBridge = {
  onEditModeToggled: () => {
    // Not used by component server, but required by interface
  },
  dashboardUpdated: (callback: (value: DashboardLayout) => void) => {
    dashboardUpdateCallbacks.add(callback);
  },
  reloadDashboard: () => {
    // Not used by component server
  },
  saveDashboard: (dashboard: DashboardLayout) => {
    saveDashboard('default', dashboard);
  },
  resetDashboard: async (resetEverything: boolean) => {
    return resetDashboard(resetEverything, 'default');
  },
  toggleLockOverlays: async () => {
    return false;
  },
  getAppVersion: async () => {
    return '1.0.0';
  },
};

export async function publishDashboardUpdates(overlayManager: OverlayManager) {
  onDashboardUpdated((dashboard) => {
    overlayManager.closeOrCreateWindows(dashboard);
    overlayManager.publishMessage('dashboardUpdated', dashboard);
    // Notify component server bridge subscribers
    dashboardUpdateCallbacks.forEach((callback) => {
      try {
        callback(dashboard);
      } catch (err) {
        console.error('Error in dashboard update callback:', err);
      }
    });
  });
  ipcMain.on('saveDashboard', (_, dashboard, options) => {
    saveDashboard('default', dashboard);
    if (options?.forceReload) {
      overlayManager.forceRefreshOverlays(dashboard);
    }
  });
  ipcMain.on('reloadDashboard', () => {
    const dashboard = getDashboard('default');
    if (!dashboard) return;
    overlayManager.closeOrCreateWindows(dashboard);
    overlayManager.publishMessage('dashboardUpdated', dashboard);
  });

  ipcMain.handle('resetDashboard', (_, resetEverything: boolean) => {
    const result = resetDashboard(resetEverything, 'default');
    overlayManager.forceRefreshOverlays(result);
    return result;
  });

  ipcMain.handle('toggleLockOverlays', () => {
    return overlayManager.toggleLockOverlays();
  });

  ipcMain.handle('getAppVersion', () => {
    return overlayManager.getVersion();
  });
}
