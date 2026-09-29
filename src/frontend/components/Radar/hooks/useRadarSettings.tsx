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

/**
 * Every field the normaliser reads, as `field: { kind, min?, max? }`. The result
 * is built from this table, which is what makes it exhaustive in both
 * directions: a field added to `RadarConfig` and missing here fails to
 * type-check, and so does a table entry the type does not have.
 *
 * Keys the saved config carries but the type does not are dropped. That is the
 * point of the whitelist, and per R8.3 the result always carries a complete,
 * in-range config.
 */
const RADAR_FIELDS = {
  radarRange: { kind: 'number', min: 0, max: MAX_PERSISTED_RADAR_RANGE_M },
  vehicleWidth: { kind: 'number', min: 0.1, max: 10 },
  vehicleLength: { kind: 'number', min: 0.1, max: 30 },
  hideInPit: { kind: 'boolean' },
  showWhenNearby: { kind: 'boolean' },
  // The show range cannot exceed the radar's own range: a car further away than
  // the disc reaches would bring the radar on for a car it cannot draw.
  showRange: { kind: 'number', min: 0, upperBound: 'radarRange' },
  fadeSeconds: { kind: 'number', min: 0, max: 10 },
  showTrackMap: { kind: 'boolean' },
  showCarNumbers: { kind: 'boolean' },
  rivalColorMode: { kind: 'enum', values: RADAR_COLOR_MODES },
  colorRival: { kind: 'colour' },
  colorPlayer: { kind: 'colour' },
  viewMode: { kind: 'enum', values: RADAR_VIEW_MODES },
  rearCameraTilt: { kind: 'number', min: 15, max: 75 },
  mapBorderColor: { kind: 'colour' },
  sideIndicatorStyle: { kind: 'enum', values: SIDE_INDICATOR_STYLES },
  sideIndicatorColor: { kind: 'colour' },
  sideIndicatorOpacity: { kind: 'number', min: 0, max: 100 },
  sideIndicatorEnabled: { kind: 'boolean' },
  mapBorderOpacity: { kind: 'number', min: 0, max: 100 },
  mapFillColor: { kind: 'colour' },
  mapFillOpacity: { kind: 'number', min: 0, max: 100 },
  showOnlyWhenOnTrack: { kind: 'boolean' },
  background: {
    kind: 'group',
    fields: { opacity: { kind: 'number', min: 0, max: 100 } },
  },
  sessionVisibility: {
    kind: 'group',
    fields: {
      race: { kind: 'boolean' },
      loneQualify: { kind: 'boolean' },
      openQualify: { kind: 'boolean' },
      practice: { kind: 'boolean' },
      offlineTesting: { kind: 'boolean' },
    },
  },
} as const satisfies FieldRules<keyof RadarConfig>;

/**
 * The rule a field is read with. `min`/`max` are only meaningful for numbers,
 * and `upperBound` names another field whose normalised value caps this one, so
 * a bound that depends on a sibling cannot drift away from it. A number with
 * `upperBound` must not also give `max`: the two caps would be picked by
 * whichever the code happened to read.
 */
type FieldRule =
  | { kind: 'number'; min: number; max?: number; upperBound?: string }
  | { kind: 'boolean' }
  | { kind: 'colour' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'group'; fields: Record<string, FieldRule> };

type FieldRules<F extends string> = Record<F, FieldRule>;

export const normaliseRadarConfig = (config: RadarConfig): RadarConfig => {
  const raw = config as unknown as Record<string, unknown>;
  const fallback = defaultConfig as unknown as Record<string, unknown>;

  // radarRange is normalised first because showRange is capped by it, so the
  // order of the table is not what decides the bound.
  const values: Record<string, unknown> = {};
  for (const field of Object.keys(RADAR_FIELDS)) {
    values[field] = normaliseField(
      RADAR_FIELDS[field as keyof typeof RADAR_FIELDS],
      raw[field],
      fallback[field],
      values
    );
  }
  return values as unknown as RadarConfig;
};

const normaliseField = (
  rule: FieldRule,
  value: unknown,
  fallback: unknown,
  normalised: Record<string, unknown>
): unknown => {
  switch (rule.kind) {
    case 'boolean':
      return booleanValue(value, fallback as boolean);
    case 'colour':
      return colourValue(value, fallback as string);
    case 'enum': {
      const values: readonly string[] = rule.values;
      return values.includes(value as string) ? value : fallback;
    }
    case 'number': {
      const fallbackNumber = finiteNumber(fallback, 0);
      // An upperBound field has already been normalised, which is why the table
      // is walked in order and radarRange is declared before showRange.
      const upper =
        rule.upperBound === undefined
          ? (rule.max ?? fallbackNumber)
          : finiteNumber(normalised[rule.upperBound], fallbackNumber);
      return boundedNumber(value, fallbackNumber, rule.min, upper);
    }
    case 'group': {
      const rawGroup =
        typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)
          : {};
      const fallbackGroup =
        typeof fallback === 'object' && fallback !== null
          ? (fallback as Record<string, unknown>)
          : {};
      const group: Record<string, unknown> = {};
      for (const key of Object.keys(rule.fields)) {
        group[key] = normaliseField(
          rule.fields[key],
          rawGroup[key],
          fallbackGroup[key],
          normalised
        );
      }
      return group;
    }
  }
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
