import { ipcMain } from 'electron';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';
import { onDashboardUpdated } from '../../storage/dashboardEvents';
import { getDashboard, saveDashboard, resetDashboard, saveGarageCoverImage, getGarageCoverImageAsDataUrl } from '../../storage/dashboards';
import { OverlayManager } from '../../overlayManager';
import { getAnalyticsOptOut as getAnalyticsOptOutStorage, setAnalyticsOptOut as setAnalyticsOptOutStorage } from '../../storage/analytics';
import { Analytics } from '../../analytics';

// Store callbacks for dashboard updates
const dashboardUpdateCallbacks: Set<(dashboard: DashboardLayout) => void> = new Set<(dashboard: DashboardLayout) => void>();
const demoModeCallbacks: Set<(isDemoMode: boolean) => void> = new Set<(isDemoMode: boolean) => void>();

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
  onDemoModeChanged: (callback: (isDemoMode: boolean) => void) => {
    demoModeCallbacks.add(callback);
  },
  getCurrentDashboard: () => {
    const dashboard = getDashboard('default');
    return dashboard;
  },
  toggleDemoMode: () => {
    return;
  },
  getAnalyticsOptOut: async () => {
    return getAnalyticsOptOutStorage();
  },
  setAnalyticsOptOut: async (optOut: boolean) => {
    setAnalyticsOptOutStorage(optOut);
  },
  stop: () => {
    return;
  },
  saveGarageCoverImage: (buffer: Uint8Array) => {
    return saveGarageCoverImage(buffer);
  },
  getGarageCoverImageAsDataUrl: (imagePath: string) => {
    return getGarageCoverImageAsDataUrl(imagePath);
  },
};

export async function publishDashboardUpdates(overlayManager: OverlayManager, analytics: Analytics) {
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

  ipcMain.handle('saveGarageCoverImage', async (_, buffer: number[]) => {
    try {
      const uint8Array = new Uint8Array(buffer);
      const imagePath = await saveGarageCoverImage(uint8Array);
      return imagePath;
    } catch (err) {
      console.error('[Bridge] Error saving garage cover image:', err);
      throw err;
    }
  });

  ipcMain.handle('getGarageCoverImageAsDataUrl', async (_, imagePath: string) => {
    try {
      const dataUrl = await getGarageCoverImageAsDataUrl(imagePath);
      return dataUrl;
    } catch (err) {
      console.error('Error loading garage cover image as data URL:', err);
      throw err;
    }
  });
  ipcMain.handle('getAnalyticsOptOut', () => {
    return getAnalyticsOptOutStorage();
  });

  ipcMain.handle('setAnalyticsOptOut', (_, optOut: boolean) => {
    setAnalyticsOptOutStorage(optOut);
    analytics.capture({
      event: 'analytics_opt_out_changed',
      properties: {
        opt_out: optOut,
      },
    });
  });
}

/**
 * Notify all registered callbacks that demo mode has changed
 * Called from iracingSdk setup when demo mode is toggled
 */
export function notifyDemoModeChanged(isDemoMode: boolean) {
  console.log('🎭 Notifying dashboard bridge callbacks of demo mode change:', isDemoMode);
  demoModeCallbacks.forEach((callback) => {
    try {
      callback(isDemoMode);
    } catch (err) {
      console.error('Error in demo mode callback:', err);
    }
  });
}
