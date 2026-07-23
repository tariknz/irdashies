import { describe, expect, it } from 'vitest';
import {
  activationThreshold,
  clampRpm,
  isLedActive,
  normalizeLedColor,
  resolveCustomShiftPoint,
  resolveLedColor,
  resolveLedCount,
  resolveThresholds,
} from './shiftLightModel';
import type { ShiftPointSettings } from '@irdashies/types';

describe('shiftLightModel', () => {
  it('clamps RPM and preserves threshold precedence', () => {
    expect(clampRpm(9000, 8000)).toBe(8000);
    expect(resolveThresholds(8000, 7000, 7600, [7200, 6000])).toEqual({
      shift: 7200,
      blink: 7200,
    });
    expect(resolveThresholds(8000, 7000, 7600, null)).toEqual({
      shift: 7000,
      blink: 7600,
    });
    expect(resolveThresholds(8000, 0, 0, null)).toEqual({
      shift: 7200,
      blink: 7760,
    });
  });

  it('resolves LED count in car, color-array, fallback order', () => {
    expect(resolveLedCount(6, ['red', 'green'])).toBe(6);
    expect(resolveLedCount(null, ['redline', 'one', 'two'])).toBe(2);
    expect(resolveLedCount(null, null)).toBe(10);
  });

  it('uses car thresholds and safely handles small fallback counts', () => {
    expect(activationThreshold(1, 6, 7000, [7500, 5000, 5500])).toBe(5500);
    expect(activationThreshold(0, 1, 7000, null)).toBe(6300);
    expect(Number.isFinite(activationThreshold(1, 3, 7000, null))).toBe(true);
  });

  it('never lights an LED at zero RPM and lights all at shift RPM', () => {
    expect(isLedActive(0, 10, 0, 7000, null)).toBe(false);
    expect(isLedActive(9, 10, 7000, 7000, null)).toBe(true);
  });

  it('preserves blink, shift, car color, and ARGB behavior', () => {
    const base = {
      index: 0,
      ledCount: 6,
      active: true,
      shiftRpm: 7000,
      blinkRpm: 7600,
      ledColors: ['#FFFF0000', '#FF00FF00'],
    };
    expect(resolveLedColor({ ...base, rpm: 7700, flash: true })).toBe(
      '#ffffff'
    );
    expect(resolveLedColor({ ...base, rpm: 7100, flash: false })).toBe(
      '#a855f7'
    );
    expect(resolveLedColor({ ...base, rpm: 6000, flash: false })).toBe(
      '#00FF00'
    );
    expect(normalizeLedColor('#ff123456')).toBe('#123456');
  });

  it('respects global and per-car custom shift flags', () => {
    const settings: ShiftPointSettings = {
      enabled: true,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {
        car: {
          enabled: false,
          carId: 'car',
          carName: 'Car',
          gearCount: 2,
          redlineRpm: 8000,
          gearShiftPoints: { '1': { shiftRpm: 7000 } },
        },
      },
    };
    expect(
      resolveCustomShiftPoint(settings, 'car', undefined, 1)
    ).toBeUndefined();
    settings.carConfigs.car.enabled = true;
    expect(resolveCustomShiftPoint(settings, 'car', undefined, 1)).toBe(7000);
    expect(
      resolveCustomShiftPoint(settings, 'car', undefined, 0)
    ).toBeUndefined();
  });
});
