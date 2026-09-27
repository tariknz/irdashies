import { describe, expect, it } from 'vitest';
import { getWidgetDefaultConfig, type RadarConfig } from '@irdashies/types';
import { normaliseRadarConfig } from './useRadarSettings';

const defaults = getWidgetDefaultConfig('radar');

describe('normaliseRadarConfig', () => {
  it('replaces malformed persisted fields with safe typed values', () => {
    const result = normaliseRadarConfig({
      ...defaults,
      radarRange: Number.POSITIVE_INFINITY,
      vehicleWidth: null,
      vehicleLength: 'bad',
      fadeSeconds: Number.NaN,
      rivalColorMode: 'unknown',
      sideIndicatorStyle: 'soft-glow',
      colorRival: 'not-a-color',
      background: null,
      sessionVisibility: null,
    } as unknown as RadarConfig);

    expect(result.radarRange).toBe(defaults.radarRange);
    expect(result.vehicleWidth).toBe(defaults.vehicleWidth);
    expect(result.vehicleLength).toBe(defaults.vehicleLength);
    expect(result.fadeSeconds).toBe(defaults.fadeSeconds);
    expect(result.rivalColorMode).toBe(defaults.rivalColorMode);
    expect(result.sideIndicatorStyle).toBe(defaults.sideIndicatorStyle);
    expect(result.colorRival).toBe(defaults.colorRival);
    expect(result.background).toEqual(defaults.background);
    expect(result.sessionVisibility).toEqual(defaults.sessionVisibility);
  });

  it('clamps every number to its own bounds', () => {
    const result = normaliseRadarConfig({
      ...defaults,
      vehicleWidth: 999,
      vehicleLength: -5,
      fadeSeconds: 999,
      rearCameraTilt: 5,
      sideIndicatorOpacity: 250,
      mapFillOpacity: -10,
      radarRange: 100000,
    } as unknown as RadarConfig);

    expect(result.vehicleWidth).toBe(10);
    expect(result.vehicleLength).toBe(0.1);
    expect(result.fadeSeconds).toBe(10);
    expect(result.rearCameraTilt).toBe(15);
    expect(result.sideIndicatorOpacity).toBe(100);
    expect(result.mapFillOpacity).toBe(0);
    expect(result.radarRange).toBe(500);
  });

  it('caps the show range at the radar range, not the other way round', () => {
    // The cap follows radarRange after that field is normalised, so a saved
    // show range above a shrunken radar range comes down with it.
    const result = normaliseRadarConfig({
      ...defaults,
      radarRange: 40,
      showRange: 120,
    } as unknown as RadarConfig);

    expect(result.showRange).toBe(40);
  });

  it('keeps a show range below the radar range untouched', () => {
    const result = normaliseRadarConfig({
      ...defaults,
      radarRange: 100,
      showRange: 60,
    } as unknown as RadarConfig);

    expect(result.showRange).toBe(60);
  });

  it('keeps a nested group complete when only part of it is saved', () => {
    const result = normaliseRadarConfig({
      ...defaults,
      background: { opacity: 55 },
      sessionVisibility: { race: false },
    } as unknown as RadarConfig);

    expect(result.background.opacity).toBe(55);
    expect(result.sessionVisibility.race).toBe(false);
    expect(result.sessionVisibility.practice).toBe(
      defaults.sessionVisibility.practice
    );
  });

  it('drops persisted keys the config type no longer has', () => {
    const result = normaliseRadarConfig({
      ...defaults,
      fadeInCars: true,
      fadeBandM: 12,
    } as unknown as RadarConfig);

    expect(result).not.toHaveProperty('fadeInCars');
    expect(result).not.toHaveProperty('fadeBandM');
    expect(Object.keys(result).sort()).toEqual(Object.keys(defaults).sort());
  });
});
