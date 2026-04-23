import type {
  DashboardLayout,
  DashboardWidget,
  DashboardProfile,
} from '@irdashies/types';
import { emitDashboardUpdated } from './dashboardEvents';
import { defaultDashboard, deepMergeConfig } from '@irdashies/types';
import { readData, writeData } from './storage';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import logger from '../logger';

const DASHBOARDS_KEY = 'dashboards';
const PROFILES_KEY = 'profiles';
const CURRENT_PROFILE_KEY = 'currentProfile';

const isDashboardChanged = (
  oldDashboard: DashboardLayout | undefined,
  newDashboard: DashboardLayout
): boolean => {
  if (!oldDashboard) return true;

  // Compare generalSettings
  if (
    JSON.stringify(oldDashboard.generalSettings) !==
    JSON.stringify(newDashboard.generalSettings)
  ) {
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
  return getOrCreateDefaultDashboardForProfile(currentProfileId);
};

export const getOrCreateDefaultDashboardForProfile = (profileId: string) => {
  const dashboard = getDashboard(profileId);

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
        const defaultWidget = defaultDashboard.widgets.find(
          (w) => w.id === widget.id
        );
        if (!defaultWidget?.config) return widget;
        return {
          ...widget,
          config: deepMergeConfig(
            defaultWidget.config as Record<string, unknown>,
            widget.config
          ),
          visibilityConfig: deepMergeConfig(
            defaultWidget.visibilityConfig as Record<string, unknown>,
            widget.visibilityConfig
          ),
        };
      }),
    };

    applyVisibilityConfigMigration(updatedDashboard);

    saveDashboard(profileId, updatedDashboard);
    return updatedDashboard;
  }

  saveDashboard(profileId, defaultDashboard);

  return defaultDashboard;
};

export const applyVisibilityConfigMigration = (dashboard: DashboardLayout) => {
  // Visibility was moved from widget.config.sessionVisibility to widget.visibilityConfig, so copy that
  // configuration across so it is not lost when updating

  dashboard.widgets.forEach((w) => {
    if (w.visibilityConfig == undefined) {
      w.visibilityConfig = {};
    }

    if (w.config?.sessionVisibility !== undefined) {
      w.visibilityConfig['sessionVisibility'] = w.config.sessionVisibility;
      delete w.config.sessionVisibility;
    }

    if (w.config?.showOnlyWhenOnTrack !== undefined) {
      w.visibilityConfig['showOnlyWhenOnTrack'] = w.config.showOnlyWhenOnTrack;
      delete w.config.showOnlyWhenOnTrack;
    }
  });
};

export const listDashboards = () => {
  const dashboards = readData<Record<string, DashboardLayout>>(DASHBOARDS_KEY);
  if (!dashboards) return {};

  return dashboards;
};

export const getDashboard = (id: string) => {
  const dashboards = readData<Record<string, DashboardLayout>>(DASHBOARDS_KEY);
  if (!dashboards) return null;

  return dashboards[id] ?? null;
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
    },
  };
  // Only save and emit if there are actual changes
  if (isDashboardChanged(existingDashboard, mergedDashboard)) {
    dashboards[id] = mergedDashboard;
    logger.info('[saveDashboard] Writing to storage for profile:', id);
    writeData(DASHBOARDS_KEY, dashboards);
    logger.info('[saveDashboard] Saved successfully to storage');

    // Only emit dashboard updated event if this is the currently active profile
    // This prevents overlay refreshes when creating/modifying non-active profiles
    const currentProfileId = getCurrentProfileId();
    if (id === currentProfileId) {
      emitDashboardUpdated(mergedDashboard);
    } else {
      logger.info(
        '[saveDashboard] Not emitting update - not current profile (saved:',
        id,
        ', current:',
        currentProfileId,
        ')'
      );
    }
  } else {
    logger.info('[saveDashboard] Dashboard unchanged, not saving');
  }
};

export const resetDashboard = (
  resetEverything = false,
  dashboardId = 'default'
) => {
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
        const defaultWidget = defaultDashboard.widgets.find(
          (w) => w.id === widget.id
        );
        return {
          ...widget,
          config: defaultWidget?.config || widget.config,
          visibilityConfig:
            defaultWidget?.visibilityConfig || widget.visibilityConfig,
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

export const saveGarageCoverImage = async (
  buffer: Uint8Array
): Promise<string> => {
  try {
    const userDataPath = app.getPath('userData');
    const assetsPath = resolve(userDataPath, 'frontend', 'assets', 'img');

    await mkdir(assetsPath, { recursive: true });

    // Detect image type from file signature (magic bytes)
    let extension = 'png'; // default

    if (buffer.length >= 4) {
      // Check PNG signature: 89 50 4E 47
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        extension = 'png';
      }
      // Check JPEG signature: FF D8 FF
      else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        extension = 'jpg';
      }
      // Check GIF signature: 47 49 46
      else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        extension = 'gif';
      }
      // Check WebP signature: RIFF...WEBP
      else if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer.length >= 12 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      ) {
        extension = 'webp';
      }
    }

    const imagePath = resolve(assetsPath, `custom-cover.${extension}`);
    logger.info(
      '[GarageCover] Writing to:',
      imagePath,
      'Extension detected:',
      extension
    );
    await writeFile(imagePath, buffer);
    logger.info('[GarageCover] File written successfully');

    // Return the file path so it can be persisted in the dashboard
    return imagePath;
  } catch (err) {
    logger.error('[GarageCover] Error saving image:', err);
    throw err;
  }
};

export const getGarageCoverImageAsDataUrl = async (
  imageFilenameOrPath: string
): Promise<string | null> => {
  try {
    // If it's just a filename, construct the full path
    let imagePath = imageFilenameOrPath;
    if (
      !imageFilenameOrPath.includes('/') &&
      !imageFilenameOrPath.includes('\\')
    ) {
      const userDataPath = app.getPath('userData');
      imagePath = resolve(
        userDataPath,
        'frontend',
        'assets',
        'img',
        imageFilenameOrPath
      );
    }

    const buffer = await readFile(imagePath);
    const base64 = Buffer.from(buffer).toString('base64');

    // Detect MIME type from file extension
    const extension = imagePath.toLowerCase().split('.').pop() || 'png';
    const mimeTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const mimeType = mimeTypeMap[extension] || 'image/png';

    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    logger.error('Error reading garage cover image:', err);
    return null;
  }
};

// ============================================
// Profile Management Functions
// ============================================

/**
 * Get or create the Default if it doesn't exist
 */
const getOrCreateDefaultProfile = (): DashboardProfile => {
  const profiles =
    readData<Record<string, DashboardProfile>>(PROFILES_KEY) || {};

  if (!profiles['default']) {
    profiles['default'] = {
      id: 'default',
      name: 'Default',
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
    // Ensure Default exists
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
  const profiles =
    readData<Record<string, DashboardProfile>>(PROFILES_KEY) || {};
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
    throw new Error('Cannot delete the Default');
  }

  // Remove the profile
  const profiles = readData<Record<string, DashboardProfile>>(PROFILES_KEY);
  if (profiles && profiles[profileId]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [profileId]: removed, ...remainingProfiles } = profiles;
    writeData(PROFILES_KEY, remainingProfiles);
  }

  // Remove the associated dashboard
  const dashboards = listDashboards();
  if (dashboards[profileId]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [profileId]: removed, ...remainingDashboards } = dashboards;
    writeData(DASHBOARDS_KEY, remainingDashboards);
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
 * Update profile theme settings
 */
export const updateProfileTheme = (
  profileId: string,
  themeSettings?: DashboardProfile['themeSettings']
): void => {
  logger.info(
    '[updateProfileTheme] Updating profile:',
    profileId,
    'with themeSettings:',
    themeSettings
  );
  const profiles = readData<Record<string, DashboardProfile>>(PROFILES_KEY);
  if (!profiles || !profiles[profileId]) {
    throw new Error(`Profile ${profileId} not found`);
  }

  profiles[profileId] = {
    ...profiles[profileId],
    themeSettings,
    lastModified: new Date().toISOString(),
  };

  writeData(PROFILES_KEY, profiles);
  logger.info('[updateProfileTheme] Saved profile, checking if current...');

  // Get the current profile ID and emit dashboard update if this is the active profile
  const currentProfileId = getCurrentProfileId();
  logger.info(
    '[updateProfileTheme] Current profile ID:',
    currentProfileId,
    'Updated profile ID:',
    profileId
  );
  if (profileId === currentProfileId) {
    const dashboard = getDashboard(profileId);
    logger.info(
      '[updateProfileTheme] This is the current profile, emitting dashboard update'
    );
    if (dashboard) {
      emitDashboardUpdated(dashboard);
      logger.info('[updateProfileTheme] Dashboard update emitted');
    } else {
      logger.info('[updateProfileTheme] No dashboard found for profile');
    }
  } else {
    logger.info('[updateProfileTheme] Not the current profile, skipping emit');
  }
};
/**
 * Clone an existing profile and its dashboard configuration
 */
export const cloneProfile = (sourceProfileId: string): DashboardProfile => {
  const sourceProfile = getProfile(sourceProfileId);
  if (!sourceProfile) {
    throw new Error(`Profile ${sourceProfileId} not found`);
  }

  const profileId = randomUUID();
  const clonedName = `${sourceProfile.name} - cloned`;

  const profiles =
    readData<Record<string, DashboardProfile>>(PROFILES_KEY) || {};

  const newProfile: DashboardProfile = {
    id: profileId,
    name: clonedName,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    themeSettings: sourceProfile.themeSettings
      ? { ...sourceProfile.themeSettings }
      : undefined,
  };

  profiles[profileId] = newProfile;
  writeData(PROFILES_KEY, profiles);

  // Copy the source dashboard to the new profile
  const sourceDashboard = getDashboard(sourceProfileId) || defaultDashboard;
  saveDashboard(profileId, structuredClone(sourceDashboard));

  return newProfile;
};

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
    // Ensure Default exists and set it as current
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
