import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReferenceLapStoreUpdater } from './ReferenceLapStoreUpdater';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useReferenceLapStore } from './ReferenceLapStore';
import { ReferenceLapBridge, Session, Telemetry } from '@irdashies/types';

describe('useReferenceLapStoreUpdater', () => {
  const mockBridge = {
    getReferenceLap: vi.fn(),
    saveReferenceLap: vi.fn(),
  } as unknown as ReferenceLapBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    useReferenceLapStore.getState().completeSession();
    // Initialize store state
    useReferenceLapStore.setState({
      trackId: -1,
    });
  });

  it('should call collectBulkData when SessionTime is 0', () => {
    const collectBulkDataSpy = vi.spyOn(
      useReferenceLapStore.getState(),
      'collectBulkData'
    );

    renderHook(() => useReferenceLapStoreUpdater(mockBridge));

    // 1. Set up session
    useSessionStore.setState({
      session: {
        WeekendInfo: {
          SeriesID: 1,
          TrackID: 2,
          SubSessionID: 3,
          TrackLength: '5 km',
        },
        DriverInfo: {
          PaceCarIdx: -1,
          Drivers: [{ CarIdx: 1, CarClassID: 10 }],
        },
      } as unknown as Session,
    });

    // 2. Trigger telemetry with SessionTime 0
    useTelemetryStore.setState({
      telemetry: {
        SessionNum: { value: [0] },
        CarIdxLapDistPct: { value: [0, 0.1] },
        CarIdxOnPitRoad: { value: [false, false] },
        SessionTime: { value: [0] },
      } as unknown as Telemetry,
    });

    expect(collectBulkDataSpy).toHaveBeenCalled();
  });

  it('should not crash when PaceCarIdx is -1', () => {
    renderHook(() => useReferenceLapStoreUpdater(mockBridge));

    expect(() => {
      useSessionStore.setState({
        session: {
          WeekendInfo: {
            SeriesID: 1,
            TrackID: 2,
            SubSessionID: 3,
            TrackLength: '5 km',
          },
          DriverInfo: {
            PaceCarIdx: -1,
            Drivers: [{ CarIdx: 1, CarClassID: 10 }],
          },
        } as unknown as Session,
      });
    }).not.toThrow();
  });

  it('should handle missing telemetry fields gracefully', () => {
    const collectBulkDataSpy = vi.spyOn(
      useReferenceLapStore.getState(),
      'collectBulkData'
    );
    renderHook(() => useReferenceLapStoreUpdater(mockBridge));

    // Trigger telemetry with missing fields
    useTelemetryStore.setState({
      telemetry: {
        SessionNum: { value: [0] },
        // Missing other fields
      } as unknown as Telemetry,
    });

    expect(collectBulkDataSpy).not.toHaveBeenCalled();
  });

  it('should not initialize when SeriesID is 0 or negative', () => {
    const initializeSpy = vi.spyOn(
      useReferenceLapStore.getState(),
      'initialize'
    );
    renderHook(() => useReferenceLapStoreUpdater(mockBridge));

    // Case: SeriesID is 0
    useSessionStore.setState({
      session: {
        WeekendInfo: {
          SeriesID: 0,
          TrackID: 2,
          SubSessionID: 3,
          TrackLength: '5 km',
        },
        DriverInfo: { PaceCarIdx: -1, Drivers: [] },
      } as unknown as Session,
    });
    expect(initializeSpy).not.toHaveBeenCalled();

    // Case: SeriesID is -2
    useSessionStore.setState({
      session: {
        WeekendInfo: {
          SeriesID: -2,
          TrackID: 2,
          SubSessionID: 3,
          TrackLength: '5 km',
        },
        DriverInfo: { PaceCarIdx: -1, Drivers: [] },
      } as unknown as Session,
    });
    expect(initializeSpy).not.toHaveBeenCalled();
  });

  it('should not initialize when TrackID is 0 or negative', () => {
    const initializeSpy = vi.spyOn(
      useReferenceLapStore.getState(),
      'initialize'
    );
    renderHook(() => useReferenceLapStoreUpdater(mockBridge));

    // Case: TrackID is 0
    useSessionStore.setState({
      session: {
        WeekendInfo: {
          SeriesID: 1,
          TrackID: 0,
          SubSessionID: 3,
          TrackLength: '5 km',
        },
        DriverInfo: { PaceCarIdx: -1, Drivers: [] },
      } as unknown as Session,
    });
    expect(initializeSpy).not.toHaveBeenCalled();

    // Case: TrackID is -2
    useSessionStore.setState({
      session: {
        WeekendInfo: {
          SeriesID: 1,
          TrackID: -2,
          SubSessionID: 3,
          TrackLength: '5 km',
        },
        DriverInfo: { PaceCarIdx: -1, Drivers: [] },
      } as unknown as Session,
    });
    expect(initializeSpy).not.toHaveBeenCalled();
  });

  it('should filter out class IDs that are 0 or negative', () => {
    const initializeSpy = vi.spyOn(
      useReferenceLapStore.getState(),
      'initialize'
    );
    renderHook(() => useReferenceLapStoreUpdater(mockBridge));

    useSessionStore.setState({
      session: {
        WeekendInfo: {
          SeriesID: 1,
          TrackID: 2,
          SubSessionID: 3,
          TrackLength: '5 km',
        },
        DriverInfo: {
          PaceCarIdx: -1,
          Drivers: [
            { CarIdx: 1, CarClassID: 10 },
            { CarIdx: 2, CarClassID: 0 },
            { CarIdx: 3, CarClassID: -1 },
            { CarIdx: 4, CarClassID: 20 },
          ],
        },
      } as unknown as Session,
    });

    expect(initializeSpy).toHaveBeenCalledWith(
      expect.anything(), // bridge
      1, // seriesId
      2, // trackId
      5000, // trackLength
      [10, 20] // classList - should only have 10 and 20
    );
  });
});
