import type { DashboardLayout, DashboardWidget, DashboardProfile } from '@irdashies/types';
import { emitDashboardUpdated } from './dashboardEvents';
import { defaultDashboard } from './defaultDashboard';
import { readData, writeData } from './storage';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';

const DASHBOARDS_KEY = 'dashboards';
const PROFILES_KEY = 'profiles';
const CURRENT_PROFILE_KEY = 'currentProfile';

const isDashboardChanged = (oldDashboard: DashboardLayout | undefined, newDashboard: DashboardLayout): boolean => {
  if (!oldDashboard) return true;

  // Compare generalSettings
  if (JSON.stringify(oldDashboard.generalSettings) !== JSON.stringify(newDashboard.generalSettings)) {
    return true;
  }

  // Compare widgets length
  if (oldDashboard.widgets.length !== newDashboard.widgets.length) return true;

  // Compare each widget
  return oldDashboard.widgets.some((oldWidget, index) => {
    const newWidget = newDashboard.widgets[index];
    return JSON.stringify(oldWidget) !== JSON.stringify(newWidget);
  });
};

export const getOrCreateDefaultDashboard = () => {
  const currentProfileId = getCurrentProfileId();
  const dashboard = getDashboard(currentProfileId);
  if (dashboard) {
    // check missing widgets
    const missingWidgets = defaultDashboard.widgets.filter(
      (defaultWidget) =>
        !dashboard.widgets.find((widget) => widget.id === defaultWidget.id)
    );

    // add missing widgets and save
    const updatedDashboard = {
      ...dashboard,
      generalSettings: {
        ...defaultDashboard.generalSettings,
        ...dashboard.generalSettings,
      },
      widgets: [...dashboard.widgets, ...missingWidgets].map((widget) => {
        // add missing default widget config
        const defaultWidget = defaultDashboard.widgets.find((w) => w.id === widget.id);
        if (!widget.config && defaultWidget?.config) {
          return { ...widget, config: defaultWidget.config };
        }
        return widget;
      }),
    };

    saveDashboard(currentProfileId, updatedDashboard);
    return updatedDashboard;
  }

  saveDashboard(currentProfileId, defaultDashboard);

  return defaultDashboard;
};

export const listDashboards = () => {
  const dashboards = readData<Record<string, DashboardLayout>>(DASHBOARDS_KEY);
  if (!dashboards) return {};

  return dashboards;
};

export const getDashboard = (id: string) => {
  const dashboards = readData<Record<string, DashboardLayout>>(DASHBOARDS_KEY);
  if (!dashboards) return null;

  return dashboards[id];
};

export const updateDashboardWidget = (
  updatedWidget: DashboardWidget,
  dashboardId = 'default'
) => {
  const dashboard = getDashboard(dashboardId);
  if (!dashboard) {
    throw new Error('Default dashboard not found');
  }

  const updatedDashboard = {
    ...dashboard,
    widgets: dashboard.widgets.map((existingWidget) =>
      existingWidget.id === updatedWidget.id ? updatedWidget : existingWidget
    ),
  };

  saveDashboard(dashboardId, updatedDashboard);
};

export const saveDashboard = (
  id: string | 'default',
  value: DashboardLayout
) => {
  const dashboards = listDashboards();
  const existingDashboard = dashboards[id];

  // Merge the existing dashboard with the new value to preserve structure
  const mergedDashboard: DashboardLayout = {
    ...existingDashboard,
    ...value,
    widgets: value.widgets || existingDashboard?.widgets || [],
    generalSettings: {
      ...existingDashboard?.generalSettings,
      ...value.generalSettings,
    }
  };

  // Only save and emit if there are actual changes
  if (isDashboardChanged(existingDashboard, mergedDashboard)) {
    dashboards[id] = mergedDashboard;
    writeData(DASHBOARDS_KEY, dashboards);
    
    // Only emit dashboard updated event if this is the currently active profile
    // This prevents overlay refreshes when creating/modifying non-active profiles
    const currentProfileId = getCurrentProfileId();
    if (id === currentProfileId) {
      emitDashboardUpdated(mergedDashboard);
    }
  }
};

export const resetDashboard = (resetEverything = false, dashboardId = 'default') => {
  const dashboard = getDashboard(dashboardId);
  if (!dashboard) {
    throw new Error('Dashboard not found');
  }

  if (resetEverything) {
    // Completely reset to default dashboard
    saveDashboard(dashboardId, defaultDashboard);
    return defaultDashboard;
  } else {
    // Reset only widget configurations while preserving positions and enabled states
    const resetDashboard: DashboardLayout = {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) => {
        const defaultWidget = defaultDashboard.widgets.find((w) => w.id === widget.id);
        return {
          ...widget,
          config: defaultWidget?.config || widget.config,
        };
      }),
      generalSettings: {
        ...defaultDashboard.generalSettings,
      },
    };

    saveDashboard(dashboardId, resetDashboard);
    return resetDashboard;
  }
};

export const saveGarageCoverImage = async (buffer: Uint8Array): Promise<string> => {
  try {
    const userDataPath = app.getPath('userData');
    const assetsPath = resolve(userDataPath, 'frontend', 'assets', 'img');

    console.log('[GarageCover] User data path:', userDataPath);
    console.log('[GarageCover] Assets path:', assetsPath);
    console.log('[GarageCover] Buffer size:', buffer.length);

    // Create directory if it doesn't exist
    console.log('[GarageCover] Creating directory...');
    await mkdir(assetsPath, { recursive: true });
    console.log('[GarageCover] Directory created successfully');

    // Detect image type from file signature (magic bytes)
    let extension = 'png'; // default

    if (buffer.length >= 4) {
      // Check PNG signature: 89 50 4E 47
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        extension = 'png';
      }
      // Check JPEG signature: FF D8 FF
      else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        extension = 'jpg';
      }
      // Check GIF signature: 47 49 46
      else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        extension = 'gif';
      }
      // Check WebP signature: RIFF...WEBP
      else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        extension = 'webp';
      }
    }

    const imagePath = resolve(assetsPath, `custom-cover.${extension}`);
    console.log('[GarageCover] Writing to:', imagePath, 'Extension detected:', extension);
    await writeFile(imagePath, buffer);
    console.log('[GarageCover] File written successfully');

    // Return the file path so it can be persisted in the dashboard
    return imagePath;
  } catch (err) {
    console.error('[GarageCover] Error saving image:', err);
    throw err;
  }
};

export const getGarageCoverImageAsDataUrl = async (imageFilenameOrPath: string): Promise<string | null> => {
  try {
    // If it's just a filename, construct the full path
    let imagePath = imageFilenameOrPath;
    if (!imageFilenameOrPath.includes('/') && !imageFilenameOrPath.includes('\\')) {
      const userDataPath = app.getPath('userData');
      imagePath = resolve(userDataPath, 'frontend', 'assets', 'img', imageFilenameOrPath);
    }

    const buffer = await readFile(imagePath);
    const base64 = Buffer.from(buffer).toString('base64');

    // Detect MIME type from file extension
    const extension = imagePath.toLowerCase().split('.').pop() || 'png';
    const mimeTypeMap: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    const mimeType = mimeTypeMap[extension] || 'image/png';

    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.error('Error reading garage cover image:', err);
    return null;
  }
};

// ============================================
// Profile Management Functions
// ============================================

/**
 * Get or create the default profile if it doesn't exist
 */
const getOrCreateDefaultProfile = (): DashboardProfile => {
  let profiles = readData<Record<string, DashboardProfile>>(PROFILES_KEY) || {};
  
  if (!profiles['default']) {
    profiles['default'] = {
      id: 'default',
      name: 'Default Profile',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    writeData(PROFILES_KEY, profiles);
  }
  
  return profiles['default'];
};

/**
 * List all available profiles
 */
export const listProfiles = (): DashboardProfile[] => {
  const profiles = readData<Record<string, DashboardProfile>>(PROFILES_KEY);
  if (!profiles) {
    // Ensure default profile exists
    getOrCreateDefaultProfile();
    return [getOrCreateDefaultProfile()];
  }
  
  return Object.values(profiles);
};

/**
 * Get a specific profile by ID
 */
export const getProfile = (profileId: string): DashboardProfile | null => {
  const profiles = readData<Record<string, DashboardProfile>>(PROFILES_KEY);
  if (!profiles) {
    return profileId === 'default' ? getOrCreateDefaultProfile() : null;
  }
  
  return profiles[profileId] || null;
};

/**
 * Create a new profile with a given name
 */
export const createProfile = (name: string): DashboardProfile => {
  const profiles = readData<Record<string, DashboardProfile>>(PROFILES_KEY) || {};
  const profileId = randomUUID();
  
  const newProfile: DashboardProfile = {
    id: profileId,
    name,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
  
  profiles[profileId] = newProfile;
  writeData(PROFILES_KEY, profiles);
  
  // Create a new dashboard for this profile based on the default
  saveDashboard(profileId, { ...defaultDashboard });
  
  return newProfile;
};

/**
 * Delete a profile and its associated dashboard
 */
export const deleteProfile = (profileId: string): void => {
  if (profileId === 'default') {
    throw new Error('Cannot delete the default profile');
  }
  
  // Remove the profile
  const profiles = readData<Record<string, DashboardProfile>>(PROFILES_KEY);
  if (profiles && profiles[profileId]) {
    delete profiles[profileId];
    writeData(PROFILES_KEY, profiles);
  }
  
  // Remove the associated dashboard
  const dashboards = listDashboards();
  if (dashboards[profileId]) {
    delete dashboards[profileId];
    writeData(DASHBOARDS_KEY, dashboards);
  }
  
  // If this was the current profile, switch to default
  const currentProfileId = getCurrentProfileId();
  if (currentProfileId === profileId) {
    // Don't emit events when auto-switching during deletion
    setCurrentProfile('default', true);
    // But do emit one update event for the new dashboard
    const dashboard = getDashboard('default');
    if (dashboard) {
      emitDashboardUpdated(dashboard);
    }
  }
};

/**
 * Rename a profile
 */
export const renameProfile = (profileId: string, newName: string): void => {
  const profiles = readData<Record<string, DashboardProfile>>(PROFILES_KEY);
  if (!profiles || !profiles[profileId]) {
    throw new Error(`Profile ${profileId} not found`);
  }
  
  profiles[profileId] = {
    ...profiles[profileId],
    name: newName,
    lastModified: new Date().toISOString(),
  };
  
  writeData(PROFILES_KEY, profiles);
};

/**
 * Get the currently active profile ID
 */
export const getCurrentProfileId = (): string => {
  const currentProfileId = readData<string>(CURRENT_PROFILE_KEY);
  if (!currentProfileId) {
    // Ensure default profile exists and set it as current
    getOrCreateDefaultProfile();
    // Use silent mode to avoid emitting events during initialization
    setCurrentProfile('default', true);
    return 'default';
  }
  return currentProfileId;
};

/**
 * Set the current active profile
 * @param profileId - The profile ID to set as current
 * @param silent - If true, don't emit dashboard update events (used during initialization)
 */
export const setCurrentProfile = (profileId: string, silent = false): void => {
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found`);
  }
  
  writeData(CURRENT_PROFILE_KEY, profileId);
  
  // Reload the dashboard for this profile
  // Only emit update if not in silent mode
  if (!silent) {
    const dashboard = getDashboard(profileId) || defaultDashboard;
    emitDashboardUpdated(dashboard);
  }
};
