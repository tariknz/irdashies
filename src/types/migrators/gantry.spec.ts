import { describe, expect, it } from 'vitest';
import { deepMergeConfig, getWidgetDefaultConfig } from '../defaultDashboard';
import { GANTRY_CONFIG_VERSION, migrateGantryConfig } from './gantry';

const defaults = getWidgetDefaultConfig('gantry') as unknown as Record<
  string,
  unknown
>;

/** The load path in dashboards.ts: deep merge first, then migrate. */
const load = (saved: Record<string, unknown> | undefined) =>
  migrateGantryConfig(saved, defaults, deepMergeConfig(defaults, saved));

/** A real saved config from before the lap graph settings existed. */
const v1Config = (): Record<string, unknown> => ({
  speedUnit: 'mph',
  driverNameFormat: 'name-surname',
  thresholdsVersion: 3,
  slowSpeedThreshold: 25,
  slowDurationSeconds: 2,
  impactDecelKmhPerSec: 200,
  impactMinSpeed: 30,
  offTrackDurationSeconds: 0.8,
  pitEntryDurationSeconds: 0.6,
  cooldownSeconds: 8,
  sessionRetention: 10,
});

describe('migrateGantryConfig', () => {
  it('seeds the lap graph block on a config that predates it', () => {
    const config = load(v1Config());

    expect(config.lapGraph).toEqual({
      yAxisMode: 'trace',
      lapWindow: 75,
      autoPin: true,
    });
    expect(config.version).toBe(GANTRY_CONFIG_VERSION);
  });

  it('keeps every other saved value when migrating', () => {
    const saved = v1Config();
    const config = load(saved);

    for (const key of Object.keys(saved)) {
      expect(config[key]).toEqual(saved[key]);
    }
  });

  it('leaves a config already at the current version alone', () => {
    const saved = {
      ...v1Config(),
      version: GANTRY_CONFIG_VERSION,
      lapGraph: { yAxisMode: 'gap', lapWindow: 20, autoPin: false },
    };

    expect(load(saved).lapGraph).toEqual({
      yAxisMode: 'gap',
      lapWindow: 20,
      autoPin: false,
    });
  });

  it('does not downgrade a config saved by a newer build', () => {
    const saved = {
      ...v1Config(),
      version: GANTRY_CONFIG_VERSION + 1,
      lapGraph: { yAxisMode: 'position', lapWindow: 120, autoPin: false },
    };

    const config = load(saved);

    expect(config.version).toBe(GANTRY_CONFIG_VERSION + 1);
    expect(config.lapGraph).toEqual({
      yAxisMode: 'position',
      lapWindow: 120,
      autoPin: false,
    });
  });

  it('is idempotent', () => {
    const once = load(v1Config());
    const twice = load(once);

    expect(twice).toEqual(once);
  });

  it('treats a missing or unusable version as version 1', () => {
    expect(load({ ...v1Config(), version: 'two' }).version).toBe(
      GANTRY_CONFIG_VERSION
    );
    expect(load({ ...v1Config(), version: Number.NaN }).version).toBe(
      GANTRY_CONFIG_VERSION
    );
  });

  it('returns the full defaults when there is no saved config', () => {
    expect(load(undefined)).toEqual(defaults);
  });

  describe('repairing a bad lap graph block', () => {
    const migrated = (lapGraph: unknown) =>
      load({ ...v1Config(), lapGraph }).lapGraph;

    it('replaces an unknown y axis mode', () => {
      expect(migrated({ yAxisMode: 'sectors' })).toMatchObject({
        yAxisMode: 'trace',
      });
    });

    it('replaces a lap window outside the supported range', () => {
      expect(migrated({ lapWindow: 0 })).toMatchObject({ lapWindow: 75 });
      expect(migrated({ lapWindow: 5000 })).toMatchObject({ lapWindow: 75 });
      expect(migrated({ lapWindow: '40' })).toMatchObject({ lapWindow: 75 });
    });

    it('rounds a fractional lap window that is otherwise in range', () => {
      expect(migrated({ lapWindow: 40.6 })).toMatchObject({ lapWindow: 41 });
    });

    it('replaces a non-boolean autoPin', () => {
      expect(migrated({ autoPin: 'yes' })).toMatchObject({ autoPin: true });
    });

    it('survives a lap graph block of the wrong shape entirely', () => {
      expect(migrated(null)).toEqual({
        yAxisMode: 'trace',
        lapWindow: 75,
        autoPin: true,
      });
      expect(migrated([1, 2, 3])).toEqual({
        yAxisMode: 'trace',
        lapWindow: 75,
        autoPin: true,
      });
    });
  });
});
