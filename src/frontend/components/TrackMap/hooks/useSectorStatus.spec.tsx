/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Driver, ReferenceLap } from '@irdashies/types';
import { useSectorStatus } from './useSectorStatus';

vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();

  return {
    ...actual,
    useTelemetryValue: vi.fn(),
    useTelemetryValuesRounded: vi.fn(),
    useSessionDrivers: vi.fn(),
    useReferenceLapStore: {
      getState: vi.fn(),
    },
  };
});

import {
  useTelemetryValue,
  useTelemetryValuesRounded,
  useSessionDrivers,
  useReferenceLapStore,
} from '@irdashies/context';

describe('useSectorStatus', () => {
  let sessionTime = 0;
  let lapCurrentLapTime = 0;
  const lapCompleted = 0;
  let carIdxLapDistPct = [0.1, 0.4];
  let drivers: Driver[];
  let referenceLap: ReferenceLap;

  beforeEach(() => {
    vi.resetAllMocks();

    drivers = [
      { CarIdx: 0, CarClassID: 1, CarNumber: '1' } as Driver,
      { CarIdx: 1, CarClassID: 1, CarNumber: '2' } as Driver,
    ];

    referenceLap = {
      classId: 1,
      startTime: 0,
      finishTime: -1,
      lastTrackedPct: -1,
      isCleanLap: false,
      refPoints: new Map(),
    };

    vi.mocked(useSessionDrivers).mockImplementation(() => drivers);
    vi.mocked(useTelemetryValuesRounded).mockImplementation((key) => {
      if (key === 'CarIdxLapDistPct') return carIdxLapDistPct;
      if (key === 'SessionTime') return [sessionTime];
      return [];
    });
    vi.mocked(useTelemetryValue).mockImplementation((key) => {
      if (key === 'SessionTime') return sessionTime;
      if (key === 'LapCurrentLapTime') return lapCurrentLapTime;
      if (key === 'LapCompleted') return lapCompleted;
      return 0;
    });
    vi.mocked(useReferenceLapStore.getState).mockReturnValue({
      getReferenceLap: vi.fn(() => referenceLap),
    } as any);
  });

  it('returns all white before any sector times are finalized', () => {
    const { result } = renderHook(() =>
      useSectorStatus({
        enabled: true,
        sectorBoundaries: [0, 0.33, 0.66, 1],
        playerProgress: 0.1,
        playerCarIdx: 0,
        playerClassId: 1,
      })
    );

    expect(result.current.sectorStatuses).toEqual(['white', 'white', 'white']);
    expect(result.current.activeSectorIndex).toBe(0);
  });

  it('finalizes a sector and keeps completed sectors visible during the lap', () => {
    const { result, rerender } = renderHook(() =>
      useSectorStatus({
        enabled: true,
        sectorBoundaries: [0, 0.33, 0.66, 1],
        playerProgress: carIdxLapDistPct[0],
        playerCarIdx: 0,
        playerClassId: 1,
      })
    );

    act(() => {
      sessionTime = 20;
      lapCurrentLapTime = 20;
      carIdxLapDistPct = [0.4, 0.4];
    });
    rerender();

    act(() => {
      sessionTime = 39;
      lapCurrentLapTime = 39;
      carIdxLapDistPct = [0.7, 0.4];
    });
    rerender();

    expect(result.current.sectorStatuses?.[0]).toBe('green');
    expect(result.current.sectorStatuses?.[1]).toBe('green');
    expect(result.current.activeSectorIndex).toBe(2);
  });

  it('suppresses purple when the player is alone without a reference lap', () => {
    drivers = [{ CarIdx: 0, CarClassID: 1, CarNumber: '1' } as Driver];

    const { result, rerender } = renderHook(() =>
      useSectorStatus({
        enabled: true,
        sectorBoundaries: [0, 0.33, 0.66, 1],
        playerProgress: carIdxLapDistPct[0],
        playerCarIdx: 0,
        playerClassId: 1,
      })
    );

    act(() => {
      sessionTime = 22;
      lapCurrentLapTime = 22;
      carIdxLapDistPct = [0.4];
    });
    rerender();

    act(() => {
      sessionTime = 44;
      lapCurrentLapTime = 44;
      carIdxLapDistPct = [0.7];
    });
    rerender();

    expect(result.current.sectorStatuses?.[1]).not.toBe('purple');
  });
});
