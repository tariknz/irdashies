import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import { deepMergeConfig, getWidgetDefaultConfig } from '@irdashies/types';
import type { RadarConfig } from '@irdashies/types';
const MAX_PERSISTED_RADAR_RANGE_M = 500;
const RADAR_COLOR_MODES = ['class', 'badge', 'custom'] as const;
const RADAR_VIEW_MODES = ['top', 'rear'] as const;
const SIDE_INDICATOR_STYLES = ['double-arc', 'follow-sector'] as const;

const defaultConfig = getWidgetDefaultConfig('radar');

const finiteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const boundedNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number => Math.max(min, Math.min(finiteNumber(value, fallback), max));

const booleanValue = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const colourValue = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

export const normaliseRadarConfig = (config: RadarConfig): RadarConfig => {
  const raw = config as unknown as Record<string, unknown>;
  const background = raw.background as Record<string, unknown> | null;
  const rawVisibility = raw.sessionVisibility as Record<string, unknown> | null;
  const visibility = defaultConfig.sessionVisibility;
  const radarRange = boundedNumber(
    raw.radarRange,
    defaultConfig.radarRange,
    0,
    MAX_PERSISTED_RADAR_RANGE_M
  );
  const colorMode = RADAR_COLOR_MODES.includes(
    raw.rivalColorMode as (typeof RADAR_COLOR_MODES)[number]
  )
    ? (raw.rivalColorMode as RadarConfig['rivalColorMode'])
    : defaultConfig.rivalColorMode;

  return {
    radarRange,
    vehicleWidth: boundedNumber(
      raw.vehicleWidth,
      defaultConfig.vehicleWidth,
      0.1,
      10
    ),
    vehicleLength: boundedNumber(
      raw.vehicleLength,
      defaultConfig.vehicleLength,
      0.1,
      30
    ),
    hideInPit: booleanValue(raw.hideInPit, defaultConfig.hideInPit),
    showWhenNearby: booleanValue(
      raw.showWhenNearby,
      defaultConfig.showWhenNearby
    ),
    showRange: boundedNumber(
      raw.showRange,
      defaultConfig.showRange,
      0,
      radarRange
    ),
    fadeSeconds: boundedNumber(
      raw.fadeSeconds,
      defaultConfig.fadeSeconds,
      0,
      10
    ),
    showTrackMap: booleanValue(raw.showTrackMap, defaultConfig.showTrackMap),
    showCarNumbers: booleanValue(
      raw.showCarNumbers,
      defaultConfig.showCarNumbers
    ),
    rivalColorMode: colorMode,
    colorRival: colourValue(raw.colorRival, defaultConfig.colorRival),
    colorPlayer: colourValue(raw.colorPlayer, defaultConfig.colorPlayer),
    viewMode: RADAR_VIEW_MODES.includes(
      raw.viewMode as (typeof RADAR_VIEW_MODES)[number]
    )
      ? (raw.viewMode as RadarConfig['viewMode'])
      : defaultConfig.viewMode,
    rearCameraTilt: boundedNumber(
      raw.rearCameraTilt,
      defaultConfig.rearCameraTilt,
      15,
      75
    ),
    mapBorderColor: colourValue(
      raw.mapBorderColor,
      defaultConfig.mapBorderColor
    ),
    sideIndicatorStyle: SIDE_INDICATOR_STYLES.includes(
      raw.sideIndicatorStyle as (typeof SIDE_INDICATOR_STYLES)[number]
    )
      ? (raw.sideIndicatorStyle as RadarConfig['sideIndicatorStyle'])
      : defaultConfig.sideIndicatorStyle,
    sideIndicatorColor: colourValue(
      raw.sideIndicatorColor,
      defaultConfig.sideIndicatorColor
    ),
    sideIndicatorOpacity: boundedNumber(
      raw.sideIndicatorOpacity,
      defaultConfig.sideIndicatorOpacity,
      0,
      100
    ),
    sideIndicatorEnabled: booleanValue(
      raw.sideIndicatorEnabled,
      defaultConfig.sideIndicatorEnabled
    ),
    mapBorderOpacity: boundedNumber(
      raw.mapBorderOpacity,
      defaultConfig.mapBorderOpacity,
      0,
      100
    ),
    mapFillColor: colourValue(raw.mapFillColor, defaultConfig.mapFillColor),
    mapFillOpacity: boundedNumber(
      raw.mapFillOpacity,
      defaultConfig.mapFillOpacity,
      0,
      100
    ),
    background: {
      opacity: boundedNumber(
        background?.opacity,
        defaultConfig.background.opacity,
        0,
        100
      ),
    },
    showOnlyWhenOnTrack: booleanValue(
      raw.showOnlyWhenOnTrack,
      defaultConfig.showOnlyWhenOnTrack
    ),
    sessionVisibility: {
      race: booleanValue(rawVisibility?.race, visibility.race),
      loneQualify: booleanValue(
        rawVisibility?.loneQualify,
        visibility.loneQualify
      ),
      openQualify: booleanValue(
        rawVisibility?.openQualify,
        visibility.openQualify
      ),
      practice: booleanValue(rawVisibility?.practice, visibility.practice),
      offlineTesting: booleanValue(
        rawVisibility?.offlineTesting,
        visibility.offlineTesting
      ),
    },
  };
};

/**
 * Always returns a complete config. Saved dashboards may predate fields added
 * later, and the disc draws with every one of them, so missing fields are
 * filled from the defaults rather than read as undefined.
 *
 * Memoised on the dashboard: this runs inside a widget that re-renders on every
 * position tick, and the merge allocates a fresh object each call.
 */
export const useRadarSettings = (): RadarConfig => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const saved = currentDashboard?.widgets.find(
      (widget) => widget.id === 'radar'
    )?.config;

    if (saved && typeof saved === 'object') {
      return normaliseRadarConfig(
        deepMergeConfig(
          defaultConfig as unknown as Record<string, unknown>,
          saved
        ) as unknown as RadarConfig
      );
    }

    return defaultConfig;
  }, [currentDashboard]);
};
