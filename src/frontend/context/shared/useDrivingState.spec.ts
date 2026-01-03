import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDrivingState } from './useDrivingState';
import { useTelemetryValue } from '../TelemetryStore/TelemetryStore';

// Mock the telemetry store
vi.mock('../TelemetryStore/TelemetryStore', () => ({
  useTelemetryValue: vi.fn(),
}));

describe('useDrivingState', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('actively driving scenarios', () => {
    it('should return true when on track and not in replay', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return true;
            case 'PlayerCarInPitStall': return false;
            case 'CarIdxOnPitRoad': return false;
            case 'IsInGarage': return false;
            case 'IsReplayPlaying': return false;
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
      expect(useTelemetryValue).toHaveBeenCalledWith('IsOnTrack');
      expect(useTelemetryValue).toHaveBeenCalledWith('PlayerCarInPitStall');
      expect(useTelemetryValue).toHaveBeenCalledWith('CarIdxOnPitRoad');
      expect(useTelemetryValue).toHaveBeenCalledWith('IsInGarage');
      expect(useTelemetryValue).toHaveBeenCalledWith('IsReplayPlaying');
    });

    it('should return true when in pit stall and not in garage/replay', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return false;
            case 'PlayerCarInPitStall': return true;
            case 'CarIdxOnPitRoad': return false;
            case 'IsInGarage': return false;
            case 'IsReplayPlaying': return false;
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
    });

    it('should return true when on pit road and not in garage/replay', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return false;
            case 'PlayerCarInPitStall': return false;
            case 'CarIdxOnPitRoad': return true;
            case 'IsInGarage': return false;
            case 'IsReplayPlaying': return false;
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
    });

    it('should return true when on track and in pit stall simultaneously', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return true;
            case 'PlayerCarInPitStall': return true;
            case 'CarIdxOnPitRoad': return false;
            case 'IsInGarage': return false;
            case 'IsReplayPlaying': return false;
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
    });
  });

  describe('non-driving scenarios', () => {
    it('should return false when in garage', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return true;
            case 'PlayerCarInPitStall': return false;
            case 'CarIdxOnPitRoad': return false;
            case 'IsInGarage': return true; // In garage
            case 'IsReplayPlaying': return false;
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should return false when watching replay', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return true;
            case 'PlayerCarInPitStall': return false;
            case 'CarIdxOnPitRoad': return false;
            case 'IsInGarage': return false;
            case 'IsReplayPlaying': return true; // Watching replay
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should return false when not on track, not in pit, not on pit road', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return false;
            case 'PlayerCarInPitStall': return false;
            case 'CarIdxOnPitRoad': return false;
            case 'IsInGarage': return false;
            case 'IsReplayPlaying': return false;
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should return false when all telemetry values are undefined', () => {
      vi.mocked(useTelemetryValue).mockReturnValue(undefined);

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false when in garage even if also in pit stall', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return false;
            case 'PlayerCarInPitStall': return true;
            case 'CarIdxOnPitRoad': return false;
            case 'IsInGarage': return true; // In garage overrides pit stall
            case 'IsReplayPlaying': return false;
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should return false when watching replay even if on track', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return true;
            case 'PlayerCarInPitStall': return false;
            case 'CarIdxOnPitRoad': return false;
            case 'IsInGarage': return false;
            case 'IsReplayPlaying': return true; // Replay overrides on track
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should handle mixed boolean and undefined values correctly', () => {
      vi.mocked(useTelemetryValue)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'IsOnTrack': return undefined;
            case 'PlayerCarInPitStall': return true;
            case 'CarIdxOnPitRoad': return undefined;
            case 'IsInGarage': return false;
            case 'IsReplayPlaying': return false;
            default: return undefined;
          }
        });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
    });
  });

  describe('telemetry calls', () => {
    it('should call useTelemetryValue with correct keys', () => {
      vi.mocked(useTelemetryValue).mockReturnValue(false);

      renderHook(() => useDrivingState());

      expect(useTelemetryValue).toHaveBeenCalledWith('IsOnTrack');
      expect(useTelemetryValue).toHaveBeenCalledWith('PlayerCarInPitStall');
      expect(useTelemetryValue).toHaveBeenCalledWith('CarIdxOnPitRoad');
      expect(useTelemetryValue).toHaveBeenCalledWith('IsInGarage');
      expect(useTelemetryValue).toHaveBeenCalledWith('IsReplayPlaying');
      expect(useTelemetryValue).toHaveBeenCalledTimes(5);
    });
  });
});
