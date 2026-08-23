import { LAP_GRAPH_LAP_WINDOW_BOUNDS } from '../widgetConfigs';
import type { LapGraphConfig, LapGraphYAxisMode } from '../widgetConfigs';

/** Current schema version of the Gantry widget config. */
export const GANTRY_CONFIG_VERSION = 2;

type Config = Record<string, unknown>;

const Y_AXIS_MODES: LapGraphYAxisMode[] = ['trace', 'position', 'gap'];

const isYAxisMode = (value: unknown): value is LapGraphYAxisMode =>
  typeof value === 'string' &&
  Y_AXIS_MODES.includes(value as LapGraphYAxisMode);

/**
 * Repairs a stored lap graph block field by field. A saved value is kept only
 * when it is still a legal value for its field; anything else falls back to the
 * default rather than reaching the chart.
 */
const coerceLapGraph = (
  saved: unknown,
  defaults: LapGraphConfig
): LapGraphConfig => {
  const block = (
    saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  ) as Config;

  const lapWindow = block.lapWindow;
  const validWindow =
    typeof lapWindow === 'number' &&
    Number.isFinite(lapWindow) &&
    lapWindow >= LAP_GRAPH_LAP_WINDOW_BOUNDS.min &&
    lapWindow <= LAP_GRAPH_LAP_WINDOW_BOUNDS.max;

  return {
    yAxisMode: isYAxisMode(block.yAxisMode)
      ? block.yAxisMode
      : defaults.yAxisMode,
    lapWindow: validWindow ? Math.round(lapWindow) : defaults.lapWindow,
    autoPin:
      typeof block.autoPin === 'boolean' ? block.autoPin : defaults.autoPin,
  };
};

/**
 * Version 1 configs predate the Lap Graph tab and hold nothing that maps onto
 * it, so the block is seeded from the defaults.
 */
export const gantryMigrators: Record<
  number,
  (cfg: Config, defaults: Config) => Config
> = {
  1: (cfg, defaults) => ({
    ...cfg,
    lapGraph: coerceLapGraph(cfg.lapGraph, defaults.lapGraph as LapGraphConfig),
    version: 2,
  }),
};

const readVersion = (saved: Config | undefined): number => {
  const version = saved?.version;
  return typeof version === 'number' && Number.isFinite(version) ? version : 1;
};

/**
 * Brings a saved Gantry config up to `GANTRY_CONFIG_VERSION`.
 *
 * Run this after `deepMergeConfig`. The version has to be read from the raw
 * `saved` config: the merged one has already picked up the current version from
 * the defaults, so it cannot say where the config started. A config at or above
 * the current version is returned untouched, which keeps a newer profile safe if
 * it is opened by an older build.
 */
export const migrateGantryConfig = (
  saved: Config | undefined,
  defaults: Config,
  merged: Config
): Config => {
  // deepMergeConfig copies saved scalars verbatim, so an illegal yAxisMode or an
  // out-of-range lapWindow reaches the chart on any load, not only an upgrade.
  const repaired = (cfg: Config): Config => ({
    ...cfg,
    lapGraph: coerceLapGraph(cfg.lapGraph, defaults.lapGraph as LapGraphConfig),
  });

  let version = readVersion(saved);
  if (version >= GANTRY_CONFIG_VERSION) return repaired(merged);

  let result = merged;
  while (version < GANTRY_CONFIG_VERSION) {
    const migrate = gantryMigrators[version];
    if (!migrate) break;
    result = migrate(result, defaults);
    version += 1;
  }

  return { ...repaired(result), version: GANTRY_CONFIG_VERSION };
};
