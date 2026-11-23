import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useActiveSimulator, useSessionStore } from '@irdashies/context';
import type { Session } from '@irdashies/types';
import { isLmuCarBundleLoaded } from '@irdashies/utils/carData';
import { useCarTachometerData } from './useCarTachometerData';

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useActiveSimulator: vi.fn(() => null),
}));

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
    vi.mocked(useActiveSimulator).mockReturnValue(null);
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

  it('has not loaded the LMU car data for iRacing', () => {
    expect(isLmuCarBundleLoaded()).toBe(false);
  });

  it('reads LMU thresholds by model and series under LMU', async () => {
    vi.mocked(useActiveSimulator).mockReturnValue('lmu');
    useSessionStore.getState().setSession({
      DriverInfo: {
        DriverCarIdx: 0,
        Drivers: [
          {
            CarIdx: 0,
            CarPath: '3_26_DKR_E72469578',
            CarModel: 'Oreca 07',
            CarScreenName: 'DKR Engineering #3:ELMS26',
          },
        ],
      },
    } as Session);
    const { result } = renderHook(() => useCarTachometerData(3));

    expect(result.current.carData).toBeNull();
    await waitFor(() =>
      expect(result.current.carData?.carName).toBe('Oreca 07 ELMS')
    );
    expect(result.current.gearRpmThresholds).toEqual(
      result.current.carData?.ledRpm[0]['3']
    );
  });

  it('keeps an unknown LMU car on the session fallback', () => {
    vi.mocked(useActiveSimulator).mockReturnValue('lmu');
    useSessionStore.getState().setSession({
      DriverInfo: {
        DriverCarIdx: 0,
        Drivers: [
          {
            CarIdx: 0,
            CarPath: 'porsche992rgt3',
            CarModel: 'Unreleased Prototype 2030',
            CarScreenName: 'Team #1:WEC',
          },
        ],
      },
    } as Session);
    const { result } = renderHook(() => useCarTachometerData(1));

    expect(result.current).toEqual({
      carData: null,
      hasCarData: false,
      gearRpmThresholds: null,
    });
  });
});
