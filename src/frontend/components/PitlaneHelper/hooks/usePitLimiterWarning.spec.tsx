import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePitLimiterWarning } from './usePitLimiterWarning';
import * as context from '@irdashies/context';
import { EngineWarnings } from '@irdashies/types';

vi.mock('@irdashies/context', () => ({
  useTelemetryValue: vi.fn(),
  useSessionStore: vi.fn(),
}));

describe('usePitLimiterWarning', () => {
  const mockSessionStore = {
    session: {
      WeekendInfo: {
        TeamRacing: 0,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(context.useSessionStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector(mockSessionStore)
    );
  });

  describe('Auto-Limiter Series Detection', () => {
    it('shows no warning when auto-limiter is engaged and player has not manually toggled', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return false; // Manual toggle OFF
        if (key === 'EngineWarnings') return EngineWarnings.PitSpeedLimiter; // Auto-limiter engaged
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      expect(result.current.showWarning).toBe(false);
      expect(result.current.warningText).toBe('');
    });

    it('shows DISABLE LIMITER warning when player manually engages in auto-limiter series', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return true; // Player manually engaged
        if (key === 'EngineWarnings') return EngineWarnings.PitSpeedLimiter; // Auto-limiter also engaged
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      expect(result.current.showWarning).toBe(true);
      expect(result.current.warningText).toBe('⚠ DISABLE LIMITER');
      expect(result.current.isTeamRaceWarning).toBe(false);
    });

    it('does not show DISABLE warning when not on pit road', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return false;
        if (key === 'dcPitSpeedLimiterToggle') return true;
        if (key === 'EngineWarnings') return EngineWarnings.PitSpeedLimiter;
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      expect(result.current.showWarning).toBe(false);
    });
  });

  describe('Manual Limiter Series', () => {
    it('shows ACTIVATE LIMITER warning when on pit road without limiter', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return false;
        if (key === 'EngineWarnings') return 0x00; // No limiter engaged
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      expect(result.current.showWarning).toBe(true);
      expect(result.current.warningText).toBe('⚠ ACTIVATE LIMITER');
      expect(result.current.isTeamRaceWarning).toBe(false);
    });

    it('shows no warning when limiter is manually engaged', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return true;
        if (key === 'EngineWarnings') return EngineWarnings.PitSpeedLimiter; // Limiter engaged
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      expect(result.current.showWarning).toBe(false);
    });

    it('shows no warning when not on pit road', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return false;
        if (key === 'dcPitSpeedLimiterToggle') return false;
        if (key === 'EngineWarnings') return 0x00;
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      expect(result.current.showWarning).toBe(false);
    });
  });

  describe('Team Racing', () => {
    const teamRacingSessionStore = {
      session: {
        WeekendInfo: {
          TeamRacing: 1,
        },
      },
    };

    beforeEach(() => {
      vi.mocked(context.useSessionStore).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (selector: any) => selector(teamRacingSessionStore)
      );
    });

    it('shows team race warning after pitstop completion when limiter not engaged', () => {
      // First render: pitstop active
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return false;
        if (key === 'EngineWarnings') return 0x00;
        if (key === 'PitstopActive') return true;
        return undefined;
      });

      const { result, rerender } = renderHook(() => usePitLimiterWarning(true));

      // No warning during pitstop
      expect(result.current.showWarning).toBe(false);

      // Second render: pitstop completed
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return false;
        if (key === 'EngineWarnings') return 0x00;
        if (key === 'PitstopActive') return false; // Just completed
        return undefined;
      });

      rerender();

      expect(result.current.showWarning).toBe(true);
      expect(result.current.warningText).toBe('⚠ ACTIVATE LIMITER');
      expect(result.current.isTeamRaceWarning).toBe(true);
    });
  });

  describe('Disabled State', () => {
    it('returns no warning when disabled', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return false;
        if (key === 'EngineWarnings') return 0x00;
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(false));

      expect(result.current.showWarning).toBe(false);
      expect(result.current.warningText).toBe('');
      expect(result.current.isTeamRaceWarning).toBe(false);
    });
  });

  describe('Engine Warnings Bitfield', () => {
    it('correctly detects pit limiter flag (EngineWarnings.PitSpeedLimiter)', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return false;
        if (key === 'EngineWarnings') return EngineWarnings.PitSpeedLimiter; // Pit speed limiter bit
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      // Auto-limiter engaged, no manual toggle, should not warn
      expect(result.current.showWarning).toBe(false);
    });

    it('ignores other engine warning flags', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return false;
        // 0x01 = water temp, 0x02 = fuel pressure, 0x04 = oil pressure
        if (key === 'EngineWarnings') return EngineWarnings.WaterTempWarning | EngineWarnings.FuelPressureWarning | EngineWarnings.OilPressureWarning;
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      // No limiter engaged, should warn to activate
      expect(result.current.showWarning).toBe(true);
      expect(result.current.warningText).toBe('⚠ ACTIVATE LIMITER');
    });

    it('detects limiter when combined with other warnings', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        if (key === 'dcPitSpeedLimiterToggle') return true;
        // EngineWarnings.PitSpeedLimiter (limiter) + 0x01 (water temp) = EngineWarnings.PitSpeedLimiter | EngineWarnings.WaterTempWarning
        if (key === 'EngineWarnings') return EngineWarnings.PitSpeedLimiter | EngineWarnings.WaterTempWarning;
        if (key === 'PitstopActive') return false;
        return undefined;
      });

      const { result } = renderHook(() => usePitLimiterWarning(true));

      // Auto-limiter + manual toggle in auto series should warn to disable
      expect(result.current.showWarning).toBe(true);
      expect(result.current.warningText).toBe('⚠ DISABLE LIMITER');
    });
  });
});
