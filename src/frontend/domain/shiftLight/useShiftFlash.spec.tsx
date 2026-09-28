import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Context from '@irdashies/context';
import * as CarData from '@irdashies/utils/carData';
import type { ShiftPointSettings } from '@irdashies/types';
import { useBlink, useShiftFlashActive } from './useShiftFlash';

vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  return {
    ...actual,
    useDriverControlsSnapshot: vi.fn(),
    useDashboard: vi.fn(),
    useSessionStore: vi.fn(),
  };
});
vi.mock('@irdashies/utils/carData', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@irdashies/utils/carData')>();
  return { ...actual, loadCarData: vi.fn() };
});

const mockSnapshot = vi.mocked(Context.useDriverControlsSnapshot);
const mockDashboard = vi.mocked(Context.useDashboard);
const mockSessionStore = vi.mocked(Context.useSessionStore);
const mockLoadCarData = vi.mocked(CarData.loadCarData);

const shiftPointSettings: ShiftPointSettings = {
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
      gearShiftPoints: { '2': { shiftRpm: 6200 } },
    },
  },
};

const sessionState = {
  session: {
    DriverInfo: {
      DriverCarIdx: 0,
      DriverCarRedLine: 7000,
      Drivers: [{ CarIdx: 0, CarPath: 'renaultclio' }],
    },
  },
};

const setRpm = (rpm: number, gear = 2) =>
  mockSnapshot.mockReturnValue({ rpm, gear, blinkRpm: 6800, version: 1 });

describe('useShiftFlashActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboard.mockReturnValue({
      currentDashboard: {
        widgets: [
          {
            id: 'tachometer',
            enabled: true,
            layout: { x: 0, y: 0, width: 1, height: 1 },
            config: { shiftPointSettings },
          },
        ],
      },
    } as unknown as ReturnType<typeof Context.useDashboard>);
    mockSessionStore.mockImplementation(((
      selector: (s: typeof sessionState) => unknown
    ) => selector(sessionState)) as unknown as typeof Context.useSessionStore);
    mockLoadCarData.mockReturnValue(null);
  });

  it('is off when disabled', () => {
    setRpm(7000);
    const { result } = renderHook(() => useShiftFlashActive(false, 'redline'));
    expect(result.current).toBe(false);
  });

  it('flashes at the iRacing blink RPM in redline mode', () => {
    setRpm(6799);
    const { result, rerender } = renderHook(() =>
      useShiftFlashActive(true, 'redline')
    );
    expect(result.current).toBe(false);

    setRpm(6800);
    rerender();
    expect(result.current).toBe(true);
  });

  it('flashes at the Tachometer shift point for this car and gear', () => {
    setRpm(6200);
    const { result } = renderHook(() =>
      useShiftFlashActive(true, 'shiftPoints')
    );
    expect(result.current).toBe(true);
  });

  it('uses the redline for a gear without a shift point', () => {
    setRpm(6200, 3);
    const { result, rerender } = renderHook(() =>
      useShiftFlashActive(true, 'shiftPoints')
    );
    expect(result.current).toBe(false);

    setRpm(6800, 3);
    rerender();
    expect(result.current).toBe(true);
  });

  it('matches shift points by the car data id', () => {
    mockLoadCarData.mockReturnValue({
      carName: 'Renault Clio',
      carId: 'renaultclio',
      carClass: 'TCR',
      ledNumber: 8,
      redlineBlinkInterval: 250,
      ledColor: [],
      ledRpm: [],
    });
    sessionState.session.DriverInfo.Drivers[0].CarPath = 'RenaultClio';
    setRpm(6200);
    const { result } = renderHook(() =>
      useShiftFlashActive(true, 'shiftPoints')
    );
    expect(result.current).toBe(true);
    sessionState.session.DriverInfo.Drivers[0].CarPath = 'renaultclio';
  });
});

describe('useBlink', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is off while inactive', () => {
    const { result } = renderHook(() => useBlink(false, 200));
    expect(result.current).toBe(false);
  });

  it('turns on at once, then toggles each interval', () => {
    const { result } = renderHook(() => useBlink(true, 200));
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(true);
  });

  it('turns off when it becomes inactive', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useBlink(active, 200),
      { initialProps: { active: true } }
    );
    act(() => vi.advanceTimersByTime(200));
    rerender({ active: false });
    expect(result.current).toBe(false);

    rerender({ active: true });
    expect(result.current).toBe(true);
  });
});
