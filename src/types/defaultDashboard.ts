import type { GeneralSettingsType } from './dashboardLayout';
import type { TypedDashboardWidget, WidgetConfigMap } from './widgetConfigs';
import { WIDGET_MANIFESTS, getWidgetManifest } from './widgets';

export const defaultDashboard: {
  widgets: TypedDashboardWidget[];
  generalSettings?: GeneralSettingsType;
} = {
  widgets: WIDGET_MANIFESTS.map(
    ({ id, enabled, alwaysEnabled, layout, config }) =>
      ({
        id,
        enabled,
        ...(alwaysEnabled !== undefined && { alwaysEnabled }),
        layout,
        config,
      }) as TypedDashboardWidget
  ),
  generalSettings: {
    fontType: 'lato',
    fontSize: 'sm',
    fontWeight: 'normal',
    colorPalette: 'black',
    showOnlyWhenOnTrack: true,
    highlightColor: 960745,
    skipTaskbar: true,
    disableHardwareAcceleration: false,
    enableAutoStart: false,
    startMinimized: false,
    closeToTray: true,
    compactMode: 'off' as const,
    overlayAlwaysOnTop: true,
    enableNetworkAccess: false,
    enableWebServer: true,
    editMode: {
      pixelDistances: false,
      snapToGrid: false,
    },
  },
};

export function getWidgetDefaultConfig<K extends keyof WidgetConfigMap>(
  id: K
): WidgetConfigMap[K] {
  const manifest = getWidgetManifest(id);
  if (!manifest) throw new Error(`No default config found for widget: ${id}`);
  return manifest.config as WidgetConfigMap[K];
}

/**
 * Deep merges a saved widget config with the default config.
 * - Saved values take precedence over defaults.
 * - Missing fields are filled from the default.
 * - Nested objects are merged recursively.
 * - Arrays named "displayOrder" are merged to preserve existing order while
 *   inserting any new default items at their relative position.
 */
export function deepMergeConfig(
  defaultCfg: Record<string, unknown>,
  savedCfg: unknown
): Record<string, unknown> {
  if (!savedCfg || typeof savedCfg !== 'object' || Array.isArray(savedCfg)) {
    return { ...defaultCfg };
  }

  const saved = savedCfg as Record<string, unknown>;
  const result: Record<string, unknown> = { ...defaultCfg };

  for (const key of Object.keys(saved)) {
    const savedVal = saved[key];
    const defaultVal = result[key];

    if (savedVal === undefined) continue;

    if (
      key === 'displayOrder' &&
      Array.isArray(savedVal) &&
      Array.isArray(defaultVal)
    ) {
      result[key] = mergeDisplayOrder(
        defaultVal as string[],
        savedVal as string[]
      );
    } else if (
      savedVal !== null &&
      typeof savedVal === 'object' &&
      !Array.isArray(savedVal) &&
      defaultVal !== null &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal)
    ) {
      result[key] = deepMergeConfig(
        defaultVal as Record<string, unknown>,
        savedVal
      );
    } else {
      result[key] = savedVal;
    }
  }

  return result;
}

function mergeDisplayOrder(
  defaultOrder: string[],
  savedOrder: string[]
): string[] {
  const merged = [...savedOrder];
  const missing = defaultOrder.filter((id) => !merged.includes(id));

  for (const missingId of missing) {
    const defaultIdx = defaultOrder.indexOf(missingId);
    let insertAt = merged.length;

    for (let i = defaultIdx + 1; i < defaultOrder.length; i++) {
      const afterIdx = merged.indexOf(defaultOrder[i]);
      if (afterIdx !== -1) {
        insertAt = afterIdx;
        break;
      }
    }

    merged.splice(insertAt, 0, missingId);
  }

  return merged;
}
