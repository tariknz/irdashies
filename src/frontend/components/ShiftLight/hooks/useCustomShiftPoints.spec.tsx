import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCustomShiftPoints } from './useCustomShiftPoints';
import type { ShiftPointSettings } from '@irdashies/types';

const settings: ShiftPointSettings = {
  enabled: true,
  indicatorType: 'glow',
  indicatorColor: '#00ff00',
  carConfigs: {
    ferrari296gt3: {
      enabled: true,
      carId: 'ferrari296gt3',
      carName: 'Ferrari 296 GT3',
      gearCount: 6,
      redlineRpm: 8000,
      gearShiftPoints: { '1': { shiftRpm: 6000 } },
    },
  },
};

describe('useCustomShiftPoints', () => {
  it('normalizes the car path before looking up saved shift points', () => {
    const { result } = renderHook(() =>
      useCustomShiftPoints(settings, 'Ferrari 296 GT3', 1, 6500)
    );
    expect(result.current.shouldShowShiftIndicator).toBe(true);
    expect(result.current.currentShiftPoint).toBe(6000);
  });

  it('keys an LMU car by its model, not by a same-named iRacing car', () => {
    // "Ferrari 499P" normalises to iRacing's ferrari499p.
    const lmuAndIracing: ShiftPointSettings = {
      ...settings,
      carConfigs: {
        ferrari499p: {
          ...settings.carConfigs.ferrari296gt3,
          carId: 'ferrari499p',
          gearShiftPoints: { '1': { shiftRpm: 5000 } },
        },
        'Ferrari 499P': {
          ...settings.carConfigs.ferrari296gt3,
          carId: 'Ferrari 499P',
          gearShiftPoints: { '1': { shiftRpm: 7000 } },
        },
      },
    };
    const { result } = renderHook(() =>
      useCustomShiftPoints(
        lmuAndIracing,
        '8_25_FERR1234ABCD.VEH',
        1,
        6500,
        null,
        'Ferrari 499P'
      )
    );
    expect(result.current.currentShiftPoint).toBe(7000);
    expect(result.current.shouldShowShiftIndicator).toBe(false);
  });

  it.each([0, -1, 2])(
    'does not trigger for gear %i without a forward shift point',
    (gear) => {
      const { result } = renderHook(() =>
        useCustomShiftPoints(settings, 'ferrari296gt3', gear, 6500)
      );
      expect(result.current.shouldShowShiftIndicator).toBe(false);
    }
  );

  it('does not trigger below the threshold', () => {
    const { result } = renderHook(() =>
      useCustomShiftPoints(settings, 'ferrari296gt3', 1, 5500)
    );
    expect(result.current.shouldShowShiftIndicator).toBe(false);
  });

  it('respects the global and per-car enable switches', () => {
    for (const disabled of [
      { ...settings, enabled: false },
      {
        ...settings,
        carConfigs: {
          ferrari296gt3: {
            ...settings.carConfigs.ferrari296gt3,
            enabled: false,
          },
        },
      },
    ]) {
      const { result, unmount } = renderHook(() =>
        useCustomShiftPoints(disabled, 'ferrari296gt3', 1, 6500)
      );
      expect(result.current.shouldShowShiftIndicator).toBe(false);
      unmount();
    }
  });
});
