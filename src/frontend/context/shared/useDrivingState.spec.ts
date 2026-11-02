import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDrivingState } from './useDrivingState';
import { useTelemetryValue } from '../TelemetryStore/TelemetryStore';

// Mock the telemetry store
vi.mock('../TelemetryStore/TelemetryStore', () => ({
  useTelemetryValue: vi.fn(),
}));

vi.mock('../ChannelStore', () => ({
  useTrackStateSelector: vi.fn((selector) =>
    selector({
      isOnTrack: useTelemetryValue('IsOnTrack'),
      playerCarInPitStall: useTelemetryValue('PlayerCarInPitStall'),
      focusCarIdx: 0,
      carIdxOnPitRoad: [useTelemetryValue('CarIdxOnPitRoad')],
      isInGarage: useTelemetryValue('IsInGarage'),
      isGarageVisible: useTelemetryValue('IsGarageVisible'),
      isReplayPlaying: useTelemetryValue('IsReplayPlaying'),
      dataStale: useTelemetryValue('LmuDataStale'),
    })
  ),
}));

describe('useDrivingState', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('actively driving scenarios', () => {
    it('should return true when on track and not in replay', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return true;
          case 'PlayerCarInPitStall':
            return false;
          case 'CarIdxOnPitRoad':
            return false;
          case 'IsInGarage':
            return false;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return false;
          default:
            return undefined;
        }
      });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
      expect(useTelemetryValue).toHaveBeenCalledWith('IsOnTrack');
      expect(useTelemetryValue).toHaveBeenCalledWith('PlayerCarInPitStall');
      expect(useTelemetryValue).toHaveBeenCalledWith('CarIdxOnPitRoad');
      expect(useTelemetryValue).toHaveBeenCalledWith('IsInGarage');
      expect(useTelemetryValue).toHaveBeenCalledWith('IsGarageVisible');
      expect(useTelemetryValue).toHaveBeenCalledWith('IsReplayPlaying');
    });

    it('should return true when in pit stall and not in garage/replay', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return false;
          case 'PlayerCarInPitStall':
            return true;
          case 'CarIdxOnPitRoad':
            return false;
          case 'IsInGarage':
            return false;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return false;
          default:
            return undefined;
        }
      });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
    });

    it('should return true when on pit road and not in garage/replay', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return false;
          case 'PlayerCarInPitStall':
            return false;
          case 'CarIdxOnPitRoad':
            return true;
          case 'IsInGarage':
            return false;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return false;
          default:
            return undefined;
        }
      });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
    });

    it('should return true when on track and in pit stall simultaneously', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return true;
          case 'PlayerCarInPitStall':
            return true;
          case 'CarIdxOnPitRoad':
            return false;
          case 'IsInGarage':
            return false;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return false;
          default:
            return undefined;
        }
      });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(true);
    });
  });

  describe('non-driving scenarios', () => {
    it('should return false when in garage', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return true;
          case 'PlayerCarInPitStall':
            return false;
          case 'CarIdxOnPitRoad':
            return false;
          case 'IsInGarage':
            return true;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return false;
          default:
            return undefined;
        }
      });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should return false when watching replay', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return true;
          case 'PlayerCarInPitStall':
            return false;
          case 'CarIdxOnPitRoad':
            return false;
          case 'IsInGarage':
            return false;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return true; // Watching replay
          default:
            return undefined;
        }
      });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should return false when not on track, not in pit, not on pit road', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return false;
          case 'PlayerCarInPitStall':
            return false;
          case 'CarIdxOnPitRoad':
            return false;
          case 'IsInGarage':
            return false;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return false;
          default:
            return undefined;
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
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return false;
          case 'PlayerCarInPitStall':
            return true;
          case 'CarIdxOnPitRoad':
            return false;
          case 'IsInGarage':
            return true; // In garage overrides pit stall
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return false;
          default:
            return undefined;
        }
      });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should return false when watching replay even if on track', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return true;
          case 'PlayerCarInPitStall':
            return false;
          case 'CarIdxOnPitRoad':
            return false;
          case 'IsInGarage':
            return false;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return true; // Replay overrides on track
          default:
            return undefined;
        }
      });

      const { result } = renderHook(() => useDrivingState());

      expect(result.current.isDriving).toBe(false);
    });

    it('should handle mixed boolean and undefined values correctly', () => {
      vi.mocked(useTelemetryValue).mockImplementation((key: string) => {
        switch (key) {
          case 'IsOnTrack':
            return undefined;
          case 'PlayerCarInPitStall':
            return true;
          case 'CarIdxOnPitRoad':
            return undefined;
          case 'IsInGarage':
            return false;
          case 'IsGarageVisible':
            return false;
          case 'IsReplayPlaying':
            return false;
          default:
            return undefined;
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
      expect(useTelemetryValue).toHaveBeenCalledWith('IsGarageVisible');
      expect(useTelemetryValue).toHaveBeenCalledWith('IsReplayPlaying');
      // Seven, not six: the frame now also carries whether the sim has
      // stopped writing it, which the selector checks before anything else.
      expect(useTelemetryValue).toHaveBeenCalledWith('LmuDataStale');
      expect(useTelemetryValue).toHaveBeenCalledTimes(7);
    });
  });
});

describe('useDrivingState with a frame the sim has stopped writing', () => {
  const frame = (overrides: Record<string, boolean>) => {
    vi.mocked(useTelemetryValue).mockImplementation(
      (key: string) => overrides[key] ?? false
    );
    return renderHook(() => useDrivingState()).result.current.isDriving;
  };

  it('is not driving once the data is stale, whatever the frame holds', () => {
    // The live case: a practice session ends with the player in the pits. The
    // last frame the sim wrote has CarIdxOnPitRoad true, and the three terms
    // are ORed -- so that alone kept every widget gated on this on screen
    // after the session was over, even with IsOnTrack already false.
    expect(frame({ CarIdxOnPitRoad: true, LmuDataStale: true })).toBe(false);
    expect(frame({ PlayerCarInPitStall: true, LmuDataStale: true })).toBe(
      false
    );
    expect(frame({ IsOnTrack: true, LmuDataStale: true })).toBe(false);
  });

  it('is driving on the same frame while the data is live', () => {
    // So the stale flag is doing the work, not the rest of the condition.
    expect(frame({ CarIdxOnPitRoad: true })).toBe(true);
    expect(frame({ IsOnTrack: true })).toBe(true);
  });

  it('is not driving in the garage, stale or not', () => {
    expect(frame({ IsOnTrack: true, IsInGarage: true })).toBe(false);
    expect(
      frame({ IsOnTrack: true, IsInGarage: true, LmuDataStale: true })
    ).toBe(false);
  });
});
