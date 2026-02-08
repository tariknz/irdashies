import type {
  DashboardBridge,
  DashboardLayout,
  DashboardProfile,
  SaveDashboardOptions,
} from '@irdashies/types';
import { app, ipcMain } from 'electron';
import { onDashboardUpdated } from '../../storage/dashboardEvents';
import {
  getDashboard,
  saveDashboard,
  resetDashboard,
  saveGarageCoverImage,
  getGarageCoverImageAsDataUrl,
  listProfiles,
  createProfile,
  deleteProfile,
  renameProfile,
  getCurrentProfileId,
  setCurrentProfile,
  getProfile,
  updateProfileTheme,
  getOrCreateDefaultDashboardForProfile,
} from '../../storage/dashboards';
import { OverlayManager } from '../../overlayManager';
import {
  getAnalyticsOptOut as getAnalyticsOptOutStorage,
  setAnalyticsOptOut as setAnalyticsOptOutStorage,
} from '../../storage/analytics';
import { Analytics } from '../../analytics';

// Store callbacks for dashboard updates
const dashboardUpdateCallbacks = new Set<
  (dashboard: DashboardLayout, profileId?: string) => void
>();
const demoModeCallbacks = new Set<(isDemoMode: boolean) => void>();

/**
 * Main dashboard bridge instance exposed to component server
 */
export const dashboardBridge: DashboardBridge = {
  onEditModeToggled: () => {
    // Not used by component server, but required by interface
  },
  dashboardUpdated: (callback: (dashboard: DashboardLayout, profileId?: string) => void) => {
    dashboardUpdateCallbacks.add(callback);
  },
  reloadDashboard: () => {
    // Not used by component server
  },
  saveDashboard: (
    dashboard: DashboardLayout,
    options?: SaveDashboardOptions
  ) => {
    const targetProfileId = options?.profileId || getCurrentProfileId();
    saveDashboard(targetProfileId, dashboard);
    if (dashboardUpdateCallbacks.size > 0) {
      dashboardUpdateCallbacks.forEach((callback) => {
        try {
          callback(dashboard, targetProfileId);
        } catch (err) {
          console.error('Error in dashboard update callback:', err);
        }
      });
    }
  },
  resetDashboard: async (resetEverything: boolean) => {
    const currentProfileId = getCurrentProfileId();
    return resetDashboard(resetEverything, currentProfileId);
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
    const currentProfileId = getCurrentProfileId();
    const dashboard = getDashboard(currentProfileId);
    return dashboard;
  },
  getDashboardForProfile: async (profileId: string) => {
    // Check if profile exists first
    const profile = getProfile(profileId);
    if (!profile) {
      console.log('[dashboardBridge] Profile not found:', profileId);
      return null;
    }

    let dashboard = getDashboard(profileId);

    // If dashboard doesn't exist for this profile, create a default one
    if (!dashboard) {
      dashboard = getOrCreateDefaultDashboardForProfile(profileId);
    }

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
  // Profile management
  listProfiles: async () => {
    return listProfiles();
  },
  createProfile: async (name: string) => {
    return createProfile(name);
  },
  deleteProfile: async (profileId: string) => {
    deleteProfile(profileId);
  },
  renameProfile: async (profileId: string, newName: string) => {
    renameProfile(profileId, newName);
  },
  switchProfile: async (profileId: string) => {
    setCurrentProfile(profileId);
  },
  getCurrentProfile: async () => {
    const currentProfileId = getCurrentProfileId();
    return getProfile(currentProfileId);
  },
  updateProfileTheme: async (profileId: string, themeSettings: DashboardProfile['themeSettings']) => {
    updateProfileTheme(profileId, themeSettings);
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
  setAutoStart: async (enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
    });
  },
};

export async function publishDashboardUpdates(
  overlayManager: OverlayManager,
  analytics: Analytics
) {
  onDashboardUpdated((dashboard) => {
    overlayManager.closeOrCreateWindows(dashboard);
    overlayManager.publishMessage('dashboardUpdated', dashboard);
    // Notify component server bridge subscribers
    dashboardUpdateCallbacks.forEach((callback) => {
      try {
        // We don't know the profileId here, so we pass undefined
        callback(dashboard, undefined);
      } catch (err) {
        console.error('Error in dashboard update callback:', err);
      }
    });
  });
  ipcMain.on('saveDashboard', (_, dashboard, options) => {
    const currentProfileId = getCurrentProfileId();
    saveDashboard(currentProfileId, dashboard);
    if (options?.forceReload) {
      overlayManager.forceRefreshOverlays(dashboard);
    }
  });
  ipcMain.on('reloadDashboard', () => {
    const currentProfileId = getCurrentProfileId();
    const dashboard = getDashboard(currentProfileId);
    if (!dashboard) return;
    overlayManager.closeOrCreateWindows(dashboard);
    overlayManager.publishMessage('dashboardUpdated', dashboard);
  });

  ipcMain.handle('resetDashboard', (_, resetEverything: boolean) => {
    const currentProfileId = getCurrentProfileId();
    const result = resetDashboard(resetEverything, currentProfileId);
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

  ipcMain.handle(
    'getGarageCoverImageAsDataUrl',
    async (_, imagePath: string) => {
      try {
        const dataUrl = await getGarageCoverImageAsDataUrl(imagePath);
        return dataUrl;
      } catch (err) {
        console.error('Error loading garage cover image as data URL:', err);
        throw err;
      }
    }
  );
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

  // Profile management IPC handlers
  ipcMain.handle('listProfiles', () => {
    return listProfiles();
  });

  ipcMain.handle('createProfile', (_, name: string) => {
    return createProfile(name);
  });

  ipcMain.handle('deleteProfile', (_, profileId: string) => {
    deleteProfile(profileId);
  });

  ipcMain.handle('renameProfile', (_, profileId: string, newName: string) => {
    renameProfile(profileId, newName);
  });

  ipcMain.handle('switchProfile', (_, profileId: string) => {
    setCurrentProfile(profileId);
    // Force refresh overlays with the new profile's dashboard
    const dashboard = getDashboard(profileId);
    if (dashboard) {
      overlayManager.forceRefreshOverlays(dashboard);
    }
  });

  ipcMain.handle('getCurrentProfile', () => {
    const currentProfileId = getCurrentProfileId();
    return getProfile(currentProfileId);
  });

  ipcMain.handle('getDashboardForProfile', async (_, profileId: string) => {
    return dashboardBridge.getDashboardForProfile(profileId);
  });

  ipcMain.handle('updateProfileTheme', (_, profileId: string, themeSettings: DashboardProfile['themeSettings']) => {
    updateProfileTheme(profileId, themeSettings);

    // If updating the current profile, force refresh overlays
    const currentProfileId = getCurrentProfileId();
    if (profileId === currentProfileId) {
      const dashboard = getDashboard(profileId);
      if (dashboard) {
        overlayManager.forceRefreshOverlays(dashboard);
      }
    }
  });

  ipcMain.handle('autostart:set', (_event, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
    });

    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('autostart:get', () => {
    return app.getLoginItemSettings().openAtLogin;
  });
};

/**
 * Notify all registered callbacks that demo mode has changed
 * Called from iracingSdk setup when demo mode is toggled
 */
export function notifyDemoModeChanged(isDemoMode: boolean) {
  console.log(
    '🎭 Notifying dashboard bridge callbacks of demo mode change:',
    isDemoMode
  );
  demoModeCallbacks.forEach((callback) => {
    try {
      callback(isDemoMode);
    } catch (err) {
      console.error('Error in demo mode callback:', err);
    }
  });
}

