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
      seriesId: -1,
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
});
