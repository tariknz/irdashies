import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  FuelCalculatorBridge,
  FuelProjectionSnapshot,
} from '@irdashies/types';
import { defaultFuelCalculatorSettings } from './defaults';
import { useFuelCalculation } from './useFuelCalculation';
import { useFuelStore } from './FuelStore';

const projection: FuelProjectionSnapshot = {
  isReplay: false,
  fuelLevel: 41.750274658203125,
  fuelLevelPct: 0.4,
  currentLap: 3,
  lapDistPct: 0.00005058342503616586,
  currentLapUsage: 0,
  projectedLapUsage: 3.77,
  lastLapUsage: 3.6420249938964844,
  sessionLapsRemain: 14,
  sessionTimeRemain: 1200,
  sessionTimeTotal: 1800,
  sessionFlags: 268697600,
  sessionState: 4,
  sessionNum: 0,
  sessionLaps: 16,
  calculatedTotalRaceLaps: 16,
  isFixedLapRace: true,
  sessionType: 'Race',
  isOnTrack: true,
  fuelTankCapacity: 104,
  completedLaps: [
    {
      lapNumber: 2,
      fuelUsed: 3.6420249938964844,
      lapTime: 131.3166666665473,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
      isInLap: false,
      wasTowed: false,
      timestamp: 340270,
      sessionNum: 0,
    },
    {
      lapNumber: 1,
      fuelUsed: 3.565399169921875,
      lapTime: 139.73333333336973,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
      isInLap: false,
      wasTowed: false,
      timestamp: 208971,
      sessionNum: 0,
    },
  ],
  engine: {
    accumulatedRefuel: 0,
    isLapDistPctReset: false,
    lapCrossingTime: 431.2000005085652,
    lapStartFuel: 41.750274658203125,
    lastLap: 3,
    lastLapDistPct: 0.00005058342503616586,
    lastSessionFlags: 268697600,
    wasOnPitRoad: false,
  },
};

const bridge: ChannelBridge = {
  subscribe: <K extends ChannelName>(
    _channel: K,
    callback: (payload: ChannelPayloads[K]) => void
  ) => {
    callback(projection as ChannelPayloads[K]);
    return () => undefined;
  },
};

describe('useFuelCalculation channel parity', () => {
  beforeEach(() => {
    useFuelStore.getState().clearAllData();
    window.channelBridge = bridge;
  });

  it('uses the completed lap from the current snapshot at a lap crossing', async () => {
    const { result } = renderHook(() =>
      useFuelCalculation(defaultFuelCalculatorSettings.safetyMargin, {
        ...defaultFuelCalculatorSettings,
        enableStorage: false,
        enableLogging: false,
      })
    );

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.lastLapUsage).toBeCloseTo(3.6420249938964844);
    expect(result.current?.avgLaps).toBeCloseTo(3.6037120819091797);
    expect(result.current?.currentLap).toBe(3);
  });

  it('does not load or save live history for recorded replay', async () => {
    const getHistoricalLaps = vi.fn(async () => []);
    const saveLap = vi.fn(async () => undefined);
    window.fuelCalculatorBridge = {
      getHistoricalLaps,
      saveLap,
      clearHistory: vi.fn(async () => undefined),
      clearAllHistory: vi.fn(async () => undefined),
      getQualifyMax: vi.fn(async () => null),
      saveQualifyMax: vi.fn(async () => undefined),
      startNewLog: vi.fn(async () => undefined),
      logData: vi.fn(async () => undefined),
    } satisfies FuelCalculatorBridge;
    window.channelBridge = {
      subscribe: <K extends ChannelName>(
        _channel: K,
        callback: (payload: ChannelPayloads[K]) => void
      ) => {
        callback({
          ...projection,
          isReplay: true,
          trackId: 'roadamerica full',
          carName: 'bmwm4gt3',
        } as ChannelPayloads[K]);
        return () => undefined;
      },
    };

    const { result } = renderHook(() =>
      useFuelCalculation(defaultFuelCalculatorSettings.safetyMargin, {
        ...defaultFuelCalculatorSettings,
        enableStorage: true,
      })
    );

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(getHistoricalLaps).not.toHaveBeenCalled();
    expect(saveLap).not.toHaveBeenCalled();
  });
});
