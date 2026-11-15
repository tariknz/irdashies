import { describe, expect, it } from 'vitest';
import { isPerfCollectionEnabled } from './perfCollectionConfig';
import { getPerfRunConfig } from './perfRunConfig';

describe('performance collection independently of capture bootstrap', () => {
  it('stays disabled without the explicit performance run flag', () => {
    expect(isPerfCollectionEnabled({})).toBe(false);
    expect(isPerfCollectionEnabled({ PERF_METRICS_COLLECTION: 'on' })).toBe(
      false
    );
  });

  it('preserves existing collection by default and disables only on exact off', () => {
    expect(isPerfCollectionEnabled({ PERF_METRICS: '1' })).toBe(true);
    expect(
      isPerfCollectionEnabled({
        PERF_METRICS: '1',
        PERF_METRICS_COLLECTION: 'on',
      })
    ).toBe(true);
    expect(
      isPerfCollectionEnabled({
        PERF_METRICS: '1',
        PERF_METRICS_COLLECTION: 'off',
      })
    ).toBe(false);
    expect(
      isPerfCollectionEnabled({
        PERF_METRICS: '1',
        PERF_METRICS_COLLECTION: 'invalid',
      })
    ).toBe(true);
  });

  it('keeps replay visibility, duration, delivery and widgets identical', () => {
    const env = {
      PERF_METRICS: '1',
      PERF_WIDGET_TYPES: 'input,relative,map',
      PERF_DURATION_SECONDS: '420',
      PERF_REPLAY_VISIBLE_WIDGETS: '1',
      PERF_WINDOW_MODE: 'display',
    };
    const enabled = getPerfRunConfig(env);
    expect(enabled.enabled).toBe(true);
    expect(
      getPerfRunConfig({ ...env, PERF_METRICS_COLLECTION: 'off' })
    ).toEqual(enabled);
  });
});
