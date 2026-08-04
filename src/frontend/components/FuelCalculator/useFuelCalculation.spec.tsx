import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  FuelProjectionSnapshot,
} from '@irdashies/types';
import { defaultFuelCalculatorSettings } from './defaults';
import { useFuelCalculation } from './useFuelCalculation';
import { useFuelStore } from './FuelStore';

const projection: FuelProjectionSnapshot = {
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
});
