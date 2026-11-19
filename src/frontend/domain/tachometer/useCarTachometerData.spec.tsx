import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@irdashies/context';
import type { Session } from '@irdashies/types';
import { useCarTachometerData } from './useCarTachometerData';

const sessionWithCars = (playerCarPath?: string) =>
  ({
    DriverInfo: {
      DriverCarIdx: 1,
      Drivers: [
        { CarIdx: 0, CarPath: 'bmwm4gt3' },
        { CarIdx: 1, CarPath: playerCarPath },
      ],
    },
  }) as Session;

describe('useCarTachometerData', () => {
  afterEach(() => {
    useSessionStore.getState().resetSession();
  });

  it('reads thresholds for the player car and responds to gear changes', () => {
    useSessionStore.getState().setSession(sessionWithCars('porsche992rgt3'));
    const { result, rerender } = renderHook(
      ({ gear }) => useCarTachometerData(gear),
      { initialProps: { gear: 1 } }
    );

    expect(result.current.carData?.carId).toBe('porsche992rgt3');
    expect(result.current.hasCarData).toBe(true);
    expect(result.current.gearRpmThresholds).toEqual(
      result.current.carData?.ledRpm[0]['1']
    );

    rerender({ gear: 2 });
    expect(result.current.gearRpmThresholds).toEqual(
      result.current.carData?.ledRpm[0]['2']
    );

    act(() => useSessionStore.getState().resetSession());
    expect(result.current).toEqual({
      carData: null,
      hasCarData: false,
      gearRpmThresholds: null,
    });
  });

  it.each([undefined, 'unsupported-car'])(
    'returns no thresholds when the player car path is %s',
    (carPath) => {
      useSessionStore.getState().setSession(sessionWithCars(carPath));
      const { result } = renderHook(() => useCarTachometerData());

      expect(result.current).toEqual({
        carData: null,
        hasCarData: false,
        gearRpmThresholds: null,
      });
    }
  );
});
