import type {
  DashboardLayout,
  DashboardWidget,
  DashboardProfile,
} from '@irdashies/types';
import { emitDashboardUpdated } from './dashboardEvents';
import {
  defaultDashboard,
  deepMergeConfig,
  normalizeWidgetScale,
  WIDGET_SCALE,
} from '@irdashies/types';
import { readData, writeData } from './storage';
import { writeFile, mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { resolve, basename, sep } from 'node:path';
import { app } from 'electron';
import { randomUUID, createHash } from 'node:crypto';
import logger from '../logger';

const DASHBOARDS_KEY = 'dashboards';
const PROFILES_KEY = 'profiles';
const CURRENT_PROFILE_KEY = 'currentProfile';

const GANTRY_THRESHOLDS_VERSION = 3;
const GANTRY_THRESHOLD_KEYS = [
  'slowSpeedThreshold',
  'slowDurationSeconds',
  'impactDecelKmhPerSec',
  'impactMinSpeed',
  'offTrackDurationSeconds',
  'pitEntryDurationSeconds',
  'cooldownSeconds',
] as const;

/**
 * Gantry thresholds have changed meaning twice, and neither change is safe to
 * convert. Version 2 moved the durations from frame counts to seconds, where a
 * saved 3-frame debounce reads as a valid 3 seconds and nothing rejects it.
 * Version 3 replaced the three sudden-stop settings with a deceleration rate,
 * which has no equivalent in the old values. Configs below the current version
 * have their thresholds dropped back to the defaults once.
 */
const migrateGantryThresholds = (
  saved: Record<string, unknown> | undefined,
  defaults: Record<string, unknown>,
  merged: Record<string, unknown>
): Record<string, unknown> => {
  const savedVersion = saved?.thresholdsVersion;
  if (
    typeof savedVersion === 'number' &&
    savedVersion >= GANTRY_THRESHOLDS_VERSION
  ) {
    return merged;
  }
  logger.info(
    '[Dashboards] Resetting Gantry thresholds to defaults: saved values are from an earlier threshold schema'
  );
  const reset: Record<string, unknown> = {
    ...merged,
    thresholdsVersion: GANTRY_THRESHOLDS_VERSION,
  };
  for (const key of GANTRY_THRESHOLD_KEYS) {
    reset[key] = defaults[key];
  }
  return reset;
};

/** Radar tuning the pole-side learning used; the pole side is fixed now. */
const REMOVED_RADAR_TUNING_KEYS = ['poleLearnAfterS', 'poleFlipFrames'];

const dropRemovedRadarTuning = (
  merged: Record<string, unknown>
): Record<string, unknown> => {
  const tuning = merged.tuning;
  if (!tuning || typeof tuning !== 'object' || Array.isArray(tuning)) {
    return merged;
  }
  const kept = Object.fromEntries(
    Object.entries(tuning).filter(
      ([key]) => !REMOVED_RADAR_TUNING_KEYS.includes(key)
    )
  );
  return { ...merged, tuning: kept };
};

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

  // Compare widgets length (stored data may lack widgets, R8.3)
  if (
    !Array.isArray(oldDashboard.widgets) ||
    oldDashboard.widgets.length !== newDashboard.widgets.length
  ) {
    return true;
  }

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

const isWidgetLayout = (value: unknown): value is DashboardWidget['layout'] => {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y, width, height } = value as Record<string, unknown>;
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    [width, height].every((size) => Number.isFinite(size) && Number(size) > 0)
  );
};

/**
 * A stored widget the overlays can lay out. An invalid layout comes from the
 * default widget of its type and the rest of the user's widget is kept; a
 * missing `enabled` stays off, as it was read before. Entries with no layout
 * to fall back on are dropped.
 */
const toStoredWidget = (value: unknown): DashboardWidget | undefined => {
  const widget =
    typeof value === 'object' && value !== null
      ? (value as Partial<Record<keyof DashboardWidget, unknown>>)
      : undefined;
  if (typeof widget?.id !== 'string') {
    logger.warn(
      '[toStoredWidget] Dropped a stored entry without an id:',
      value
    );
    return undefined;
  }
  const typeId = typeof widget.type === 'string' ? widget.type : widget.id;
  const storedLayout = isWidgetLayout(widget.layout)
    ? widget.layout
    : undefined;
  const layout =
    storedLayout ??
    defaultDashboard.widgets.find((w) => w.id === typeId)?.layout;
  if (!layout) {
    logger.warn(
      '[toStoredWidget] Dropped widget with no usable layout:',
      widget.id,
      widget.layout
    );
    return undefined;
  }
  if (!storedLayout) {
    logger.warn(
      '[toStoredWidget] Replaced an invalid layout with the default for:',
      widget.id,
      widget.layout
    );
  }
  // Spread in place so key order, and the change check, stay the same.
  const repaired: DashboardWidget = {
    ...(value as DashboardWidget),
    enabled: widget.enabled === true,
    layout: { ...layout },
  };
  if (typeof repaired.type !== 'string') delete repaired.type;
  // Standings originally stored its content scale in its own config. Move it
  // before merging defaults, including for custom instances of that type.
  if (
    typeId === 'standings' &&
    typeof repaired.config === 'object' &&
    repaired.config !== null &&
    !Array.isArray(repaired.config) &&
    Object.hasOwn(repaired.config, 'scale')
  ) {
    if (repaired.scale === undefined) {
      repaired.scale = normalizeWidgetScale(repaired.config.scale);
    }
    repaired.config = { ...repaired.config };
    delete repaired.config.scale;
  }
  if (repaired.scale !== undefined) {
    repaired.scale = normalizeWidgetScale(repaired.scale);
  }
  return repaired;
};

/**
 * A stored dashboard with what it predates filled in: widgets added since,
 * general settings and config values from the defaults, and the config
 * migrations. Stored data is untrusted (R8.3): widgets are repaired or
 * dropped (see toStoredWidget, which logs both) instead of failing the whole
 * dashboard. Doesn't touch storage; callers save.
 */
export const withDashboardDefaults = (
  dashboard: DashboardLayout
): DashboardLayout => {
  const storedWidgets = Array.isArray(dashboard.widgets)
    ? dashboard.widgets.flatMap((value) => toStoredWidget(value) ?? [])
    : [];

  // check missing widgets
  const missingWidgets = defaultDashboard.widgets.filter(
    (defaultWidget) =>
      !storedWidgets.find((widget) => widget.id === defaultWidget.id)
  );

  return {
    ...dashboard,
    generalSettings: {
      ...defaultDashboard.generalSettings,
      ...dashboard.generalSettings,
    },
    widgets: [...storedWidgets, ...missingWidgets].map((widget) => {
      const defaultWidget = defaultDashboard.widgets.find(
        (w) => w.id === widget.id
      );
      if (!defaultWidget?.config) return widget;
      const defaults = defaultWidget.config as Record<string, unknown>;
      const merged = deepMergeConfig(defaults, widget.config) as Record<
        string,
        unknown
      >;
      return {
        ...widget,
        config:
          widget.id === 'gantry'
            ? migrateGantryThresholds(
                widget.config as Record<string, unknown> | undefined,
                defaults,
                merged
              )
            : widget.id === 'radar'
              ? dropRemovedRadarTuning(merged)
              : merged,
      };
    }),
  };
};

export const getOrCreateDefaultDashboardForProfile = (profileId: string) => {
  const dashboard = getDashboard(profileId);

  if (dashboard) {
    const updatedDashboard = withDashboardDefaults(dashboard);
    saveDashboard(profileId, updatedDashboard);
    return updatedDashboard;
  }

  saveDashboard(profileId, defaultDashboard);

  return defaultDashboard;
};

/**
 * Fills in what stored dashboards predate (see withDashboardDefaults) for
 * every inactive profile, so a profile saved by an older version doesn't hand
 * its widgets and settings pages missing values. The active profile is filled
 * in as it loads (getOrCreateDefaultDashboard), and a profile as it becomes
 * active (setCurrentProfile). Runs in memory and writes once; it never stops
 * startup over bad stored data.
 */
export const applyDefaultsToAllProfiles = () => {
  try {
    const dashboards = listDashboards();
    const currentProfileId = getCurrentProfileId();
    const updated = { ...dashboards };
    let changed = false;
    for (const profile of listProfiles()) {
      const id: unknown = profile?.id;
      if (typeof id !== 'string' || id === currentProfileId) continue;
      const dashboard = dashboards[id];
      if (typeof dashboard !== 'object' || dashboard === null) continue;
      try {
        const next = withDashboardDefaults(dashboard);
        if (JSON.stringify(next) !== JSON.stringify(dashboard)) {
          updated[id] = next;
          changed = true;
        }
      } catch (error) {
        logger.warn(
          '[applyDefaultsToAllProfiles] Could not fill in defaults for profile:',
          id,
          error
        );
      }
    }
    // Inactive profiles only, so there is nothing to emit.
    if (changed) writeData(DASHBOARDS_KEY, updated);
  } catch (error) {
    logger.warn('[applyDefaultsToAllProfiles] Skipped:', error);
  }
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
          scale: WIDGET_SCALE.default,
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
    const userDataPath = app.getPath('userData');
    const allowedBase = resolve(userDataPath, 'frontend', 'assets', 'img');
    const imagePath = resolve(allowedBase, basename(imageFilenameOrPath));
    if (!imagePath.startsWith(allowedBase + sep)) {
      logger.warn(
        'Blocked path traversal attempt in getGarageCoverImageAsDataUrl:',
        imageFilenameOrPath
      );
      return null;
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

export const savePlayerIconImage = async (
  buffer: Uint8Array
): Promise<string> => {
  try {
    const userDataPath = app.getPath('userData');
    const assetsPath = resolve(userDataPath, 'frontend', 'assets', 'img');

    await mkdir(assetsPath, { recursive: true });

    let extension = 'png';

    if (buffer.length >= 4) {
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        extension = 'png';
      } else if (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      ) {
        extension = 'jpg';
      } else if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46
      ) {
        extension = 'gif';
      } else if (
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
      } else if (
        Buffer.from(buffer.slice(0, 1024)).toString('utf8').includes('<svg')
      ) {
        extension = 'svg';
      }
    }

    // Hash the contents so each unique upload gets a unique filename. This
    // makes replacements visible to the live map (the hook keys off the
    // filename) and avoids orphaning a different-extension file with the same
    // base name.
    const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 10);
    const imagePath = resolve(assetsPath, `player-icon-${hash}.${extension}`);

    // Remove any previous player-icon-*.* files so we don't accumulate stale
    // assets when the user replaces the icon.
    try {
      const existing = await readdir(assetsPath);
      await Promise.all(
        existing
          .filter(
            (name) =>
              name.startsWith('player-icon-') &&
              name !== `player-icon-${hash}.${extension}`
          )
          .map((name) =>
            unlink(resolve(assetsPath, name)).catch((err) => {
              logger.warn('[PlayerIcon] Failed to remove old icon:', name, err);
            })
          )
      );
    } catch (cleanupErr) {
      logger.warn('[PlayerIcon] Failed to clean up old icons:', cleanupErr);
    }

    logger.info(
      '[PlayerIcon] Writing to:',
      imagePath,
      'Extension detected:',
      extension
    );
    await writeFile(imagePath, buffer);
    logger.info('[PlayerIcon] File written successfully');

    return imagePath;
  } catch (err) {
    logger.error('[PlayerIcon] Error saving image:', err);
    throw err;
  }
};

export const getPlayerIconImageAsDataUrl = async (
  imageFilenameOrPath: string
): Promise<string | null> => {
  try {
    const userDataPath = app.getPath('userData');
    const allowedBase = resolve(userDataPath, 'frontend', 'assets', 'img');
    const imagePath = resolve(allowedBase, basename(imageFilenameOrPath));
    if (!imagePath.startsWith(allowedBase + sep)) {
      logger.warn(
        'Blocked path traversal attempt in getPlayerIconImageAsDataUrl:',
        imageFilenameOrPath
      );
      return null;
    }

    const buffer = await readFile(imagePath);
    const extension = imagePath.toLowerCase().split('.').pop() || 'png';
    const mimeTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    const mimeType = mimeTypeMap[extension] || 'image/png';
    const base64 = Buffer.from(buffer).toString('base64');

    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    logger.error('Error reading player icon image:', err);
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

  // Fill in what the stored dashboard predates (e.g. it was imported or saved
  // by an older version). Saved while the profile is still inactive, so the
  // save doesn't emit; the emit below then carries the filled-in dashboard.
  let dashboard = getDashboard(profileId) || defaultDashboard;
  if (!silent && dashboard !== defaultDashboard) {
    try {
      const filled = withDashboardDefaults(dashboard);
      saveDashboard(profileId, filled);
      dashboard = filled;
    } catch (error) {
      logger.warn(
        '[setCurrentProfile] Could not fill in defaults for profile:',
        profileId,
        error
      );
    }
  }

  writeData(CURRENT_PROFILE_KEY, profileId);

  // Reload the dashboard for this profile
  // Only emit update if not in silent mode
  if (!silent) {
    emitDashboardUpdated(dashboard);
  }
};
