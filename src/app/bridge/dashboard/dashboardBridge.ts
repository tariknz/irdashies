import { ipcMain } from 'electron';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';
import { onDashboardUpdated } from '../../storage/dashboardEvents';
import { getDashboard, saveDashboard, resetDashboard, saveGarageCoverImage, getGarageCoverImage, getGarageCoverImageAsDataUrl } from '../../storage/dashboards';
import { OverlayManager } from '../../overlayManager';

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
  stop: () => {
    return;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  saveGarageCoverImage: function (buffer: Uint8Array): Promise<string> {
    throw new Error('Function not implemented.');
  },
  getGarageCoverImage: function (): Promise<string | null> {
    throw new Error('Function not implemented.');
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getGarageCoverImageAsDataUrl: function (imagePath: string): Promise<string | null> {
    throw new Error('Function not implemented.');
  }
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

  ipcMain.handle('saveGarageCoverImage', async (_, buffer: number[]) => {
    try {
      console.log('[Bridge] saveGarageCoverImage called with buffer length:', buffer.length);
      const uint8Array = new Uint8Array(buffer);
      console.log('[Bridge] Converted to Uint8Array, length:', uint8Array.length);
      const imagePath = await saveGarageCoverImage(uint8Array);
      console.log('[Bridge] Image saved successfully at:', imagePath);
      return imagePath;
    } catch (err) {
      console.error('[Bridge] Error saving garage cover image:', err);
      throw err;
    }
  });

  ipcMain.handle('getGarageCoverImage', async () => {
    try {
      const dataUrl = await getGarageCoverImage();
      return dataUrl;
    } catch (err) {
      console.error('Error getting garage cover image:', err);
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
