import type {
  DashboardBridge,
  DashboardLayout,
  DashboardProfile,
  DriverTagSettings,
  SaveDashboardOptions,
} from '@irdashies/types';
import { app, ipcMain } from 'electron';
import { onDashboardUpdated } from '../../storage/dashboardEvents';
import {
  getDriverTagSettings,
  saveDriverTagSettings,
} from '../../storage/driverTagSettings';
import {
  getDashboard,
  saveDashboard,
  resetDashboard,
  saveGarageCoverImage,
  getGarageCoverImageAsDataUrl,
  listDashboards,
  listProfiles,
  createProfile,
  cloneProfile,
  deleteProfile,
  renameProfile,
  getCurrentProfileId,
  setCurrentProfile,
  getProfile,
  updateProfileTheme,
  getOrCreateDefaultDashboardForProfile,
} from '../../storage/dashboards';
import { writeData } from '../../storage/storage';
import { OverlayManager } from '../../overlayManager';
import {
  getAnalyticsOptOut as getAnalyticsOptOutStorage,
  setAnalyticsOptOut as setAnalyticsOptOutStorage,
} from '../../storage/analytics';
import { Analytics } from '../../analytics';
import logger from '../../logger';

/**
 * Injects global driver tag settings into a dashboard layout before broadcasting.
 * Overlays read from generalSettings.driverTagSettings, so merging here keeps them
 * compatible without requiring any changes to overlay components.
 */
const mergeDriverTagsIntoLayout = (
  dashboard: DashboardLayout,
  tagSettings: DriverTagSettings | undefined
): DashboardLayout => {
  if (!tagSettings) return dashboard;
  return {
    ...dashboard,
    generalSettings: {
      ...dashboard.generalSettings,
      driverTagSettings: tagSettings,
    },
  };
};

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
    return undefined;
  },
  dashboardUpdated: (
    callback: (dashboard: DashboardLayout, profileId?: string) => void
  ) => {
    dashboardUpdateCallbacks.add(callback);
    return () => dashboardUpdateCallbacks.delete(callback);
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
          logger.error('Error in dashboard update callback:', err);
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
    return () => demoModeCallbacks.delete(callback);
  },
  getCurrentDashboard: () => {
    const currentProfileId = getCurrentProfileId();
    const dashboard = getDashboard(currentProfileId);
    if (!dashboard) return dashboard;
    return mergeDriverTagsIntoLayout(dashboard, getDriverTagSettings());
  },
  getDashboardForProfile: async (profileId: string) => {
    // Check if profile exists first
    const profile = getProfile(profileId);
    if (!profile) {
      logger.info('[dashboardBridge] Profile not found:', profileId);
      return null;
    }

    let dashboard = getDashboard(profileId);

    // If dashboard doesn't exist for this profile, create a default one
    if (!dashboard) {
      dashboard = getOrCreateDefaultDashboardForProfile(profileId);
    }

    return mergeDriverTagsIntoLayout(dashboard, getDriverTagSettings());
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
  cloneProfile: async (profileId: string) => {
    return cloneProfile(profileId);
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
  updateProfileTheme: async (
    profileId: string,
    themeSettings: DashboardProfile['themeSettings']
  ) => {
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
  exportDashboardToFile: async () => false,
  importDashboardFromFile: async () => null,
  setAutoStart: async (enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
    });
  },
  getDriverTagSettings: async () => {
    return getDriverTagSettings();
  },
  saveDriverTagSettings: async (settings: DriverTagSettings) => {
    saveDriverTagSettings(settings);
  },
};

export async function publishDashboardUpdates(
  overlayManager: OverlayManager,
  analytics: Analytics
) {
  onDashboardUpdated((dashboard) => {
    const merged = mergeDriverTagsIntoLayout(dashboard, getDriverTagSettings());
    const profileId = getCurrentProfileId();
    overlayManager.closeOrCreateWindows(merged);
    overlayManager.publishMessage('dashboardUpdated', merged);
    // Notify component server bridge subscribers
    dashboardUpdateCallbacks.forEach((callback) => {
      try {
        callback(merged, profileId);
      } catch (err) {
        logger.error('Error in dashboard update callback:', err);
      }
    });
  });
  ipcMain.on('saveDashboard', (_, dashboard, options) => {
    // For layout-only changes (drag/resize), skip the window refresh
    if (options?.skipWindowRefresh) {
      // Save without emitting event to avoid window recreation
      const currentProfileId = getCurrentProfileId();
      const existingDashboards = listDashboards();
      existingDashboards[currentProfileId] = dashboard;
      writeData('dashboards', existingDashboards);
      // Create windows for any new displays the widget may have been dragged to
      overlayManager.ensureDisplayWindows(dashboard);
      // Still notify renderer of the update
      overlayManager.publishMessage('dashboardUpdated', dashboard);
      return;
    }

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
    const merged = mergeDriverTagsIntoLayout(dashboard, getDriverTagSettings());
    overlayManager.closeOrCreateWindows(merged);
    overlayManager.publishMessage('dashboardUpdated', merged);
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
      logger.error('[Bridge] Error saving garage cover image:', err);
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
        logger.error('Error loading garage cover image as data URL:', err);
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

  ipcMain.handle('cloneProfile', (_, profileId: string) => {
    return cloneProfile(profileId);
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
    const dashboard = await dashboardBridge.getDashboardForProfile(profileId);
    if (!dashboard) return dashboard;
    return mergeDriverTagsIntoLayout(dashboard, getDriverTagSettings());
  });

  ipcMain.handle(
    'updateProfileTheme',
    (
      _,
      profileId: string,
      themeSettings: DashboardProfile['themeSettings']
    ) => {
      updateProfileTheme(profileId, themeSettings);

      // If updating the current profile, force refresh overlays
      const currentProfileId = getCurrentProfileId();
      if (profileId === currentProfileId) {
        const dashboard = getDashboard(profileId);
        if (dashboard) {
          overlayManager.forceRefreshOverlays(dashboard);
        }
      }
    }
  );

  ipcMain.handle(
    'exportDashboardToFile',
    async (_, dashboard: DashboardLayout) => {
      const { dialog } = await import('electron');
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export Dashboard',
        defaultPath: 'dashboard.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) return false;
      const { writeFile } = await import('node:fs/promises');
      await writeFile(filePath, JSON.stringify(dashboard, null, 2), 'utf-8');
      return true;
    }
  );

  ipcMain.handle('importDashboardFromFile', async () => {
    const { dialog } = await import('electron');
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Dashboard',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(filePaths[0], 'utf-8');
    return JSON.parse(content) as DashboardLayout;
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

  ipcMain.handle('getDriverTagSettings', () => {
    return getDriverTagSettings();
  });

  ipcMain.handle('saveDriverTagSettings', (_, settings: DriverTagSettings) => {
    saveDriverTagSettings(settings);

    // Refresh Electron overlay windows (active profile only)
    const currentProfileId = getCurrentProfileId();
    const currentDashboard = getDashboard(currentProfileId);
    if (currentDashboard) {
      const merged = mergeDriverTagsIntoLayout(currentDashboard, settings);
      overlayManager.publishMessage('dashboardUpdated', merged);
    }

    // Notify all profiles' browser views (e.g. OBS stream overlays).
    // Driver tag settings are global, so every profile's view needs refreshing.
    listProfiles().forEach((profile) => {
      const dashboard = getDashboard(profile.id);
      if (!dashboard) return;
      const merged = mergeDriverTagsIntoLayout(dashboard, settings);
      dashboardUpdateCallbacks.forEach((callback) => {
        try {
          callback(merged, profile.id);
        } catch {
          // ignore
        }
      });
    });
  });
}

/**
 * Notify all registered callbacks that demo mode has changed
 * Called from iracingSdk setup when demo mode is toggled
 */
export function notifyDemoModeChanged(isDemoMode: boolean) {
  logger.info(
    'Notifying dashboard bridge callbacks of demo mode change:',
    isDemoMode
  );
  demoModeCallbacks.forEach((callback) => {
    try {
      callback(isDemoMode);
    } catch (err) {
      logger.error('Error in demo mode callback:', err);
    }
  });
}
