import { describe, it, expect } from 'vitest';
import type { ShiftPointSettings } from '@irdashies/types';
import {
  getCustomShiftRpm,
  getRedlineFlashRpm,
  getShiftFlashRpm,
  isShiftFlashActive,
} from './shiftLight';

const settings = (
  overrides: Partial<ShiftPointSettings> = {}
): ShiftPointSettings => ({
  enabled: true,
  indicatorType: 'glow',
  indicatorColor: '#00ff00',
  carConfigs: {
    renaultclio: {
      enabled: true,
      carId: 'renaultclio',
      carName: 'Renault Clio',
      gearCount: 6,
      redlineRpm: 7000,
      gearShiftPoints: { '1': { shiftRpm: 6400 }, '2': { shiftRpm: 6600 } },
    },
  },
  ...overrides,
});

describe('getRedlineFlashRpm', () => {
  it('prefers the per-gear redline from car data', () => {
    expect(getRedlineFlashRpm(7000, 6800, 6900)).toBe(6900);
  });

  it('uses the iRacing blink RPM when there is no car data', () => {
    expect(getRedlineFlashRpm(7000, 6800, undefined)).toBe(6800);
  });

  it('falls back to 97% of the redline', () => {
    expect(getRedlineFlashRpm(7000, 0, null)).toBe(6790);
  });
});

describe('getCustomShiftRpm', () => {
  it('returns the shift point for the car and gear', () => {
    expect(getCustomShiftRpm(settings(), 'renaultclio', 2)).toBe(6600);
  });

  it('returns undefined when custom shift points are off', () => {
    expect(
      getCustomShiftRpm(settings({ enabled: false }), 'renaultclio', 1)
    ).toBeUndefined();
  });

  it('returns undefined when the car is disabled', () => {
    const s = settings();
    s.carConfigs.renaultclio.enabled = false;
    expect(getCustomShiftRpm(s, 'renaultclio', 1)).toBeUndefined();
  });

  it('returns undefined for an unknown car', () => {
    expect(getCustomShiftRpm(settings(), 'mx5', 1)).toBeUndefined();
  });

  it('returns undefined for a gear without a shift point', () => {
    expect(getCustomShiftRpm(settings(), 'renaultclio', 3)).toBeUndefined();
  });

  it('returns undefined in neutral and reverse', () => {
    expect(getCustomShiftRpm(settings(), 'renaultclio', 0)).toBeUndefined();
    expect(getCustomShiftRpm(settings(), 'renaultclio', -1)).toBeUndefined();
  });

  it('returns undefined when settings or car are missing', () => {
    expect(getCustomShiftRpm(undefined, 'renaultclio', 1)).toBeUndefined();
    expect(getCustomShiftRpm(settings(), undefined, 1)).toBeUndefined();
  });
});

describe('getShiftFlashRpm', () => {
  it('uses the redline in redline mode', () => {
    expect(getShiftFlashRpm('redline', 6400, 6900)).toBe(6900);
  });

  it('uses the custom shift point in shift point mode', () => {
    expect(getShiftFlashRpm('shiftPoints', 6400, 6900)).toBe(6400);
  });

  it('falls back to the redline when no shift point is set', () => {
    expect(getShiftFlashRpm('shiftPoints', undefined, 6900)).toBe(6900);
  });
});

describe('isShiftFlashActive', () => {
  it('is active at and above the threshold', () => {
    expect(isShiftFlashActive(6400, 6400)).toBe(true);
    expect(isShiftFlashActive(6500, 6400)).toBe(true);
  });

  it('is inactive below the threshold', () => {
    expect(isShiftFlashActive(6399, 6400)).toBe(false);
  });

  it('is inactive with no RPM or no threshold', () => {
    expect(isShiftFlashActive(0, 0)).toBe(false);
    expect(isShiftFlashActive(5000, 0)).toBe(false);
  });
});
