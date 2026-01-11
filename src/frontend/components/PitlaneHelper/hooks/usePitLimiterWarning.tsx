import { useState, useEffect, useMemo, useRef } from 'react';
import { useTelemetryValue, useSessionStore } from '@irdashies/context';

export interface PitLimiterWarningResult {
  showWarning: boolean;
  isTeamRaceWarning: boolean;
  warningText: string;
}

export const usePitLimiterWarning = (enabled: boolean): PitLimiterWarningResult => {
  const session = useSessionStore((state) => state.session);
  const onPitRoad = useTelemetryValue('OnPitRoad') ?? false;
  const limiterActive = useTelemetryValue('dcPitSpeedLimiterToggle') ?? false;
  const pitstopActive = useTelemetryValue('PitstopActive') ?? false;
  const isTeamRacing = (session?.WeekendInfo?.TeamRacing ?? 0) === 1;

  // Track previous pitstop state for team race warning
  const prevPitstopActive = useRef(pitstopActive);
  const [teamRaceWarningActive, setTeamRaceWarningActive] = useState(false);
  const teamRaceWarningTimer = useRef<NodeJS.Timeout | null>(null);

  // Detect pitstop completion and manage warning state
  useEffect(() => {
    if (!enabled || !isTeamRacing) {
      if (teamRaceWarningActive) {
        setTeamRaceWarningActive(false);
      }
      return;
    }

    // Detect pitstop completion (transition from true to false)
    const justCompletedPitstop = prevPitstopActive.current && !pitstopActive;

    // Store current state for next comparison
    prevPitstopActive.current = pitstopActive;

    // Handle pitstop completion
    if (justCompletedPitstop && !limiterActive) {
      // Clear any existing timer first
      if (teamRaceWarningTimer.current) {
        clearTimeout(teamRaceWarningTimer.current);
      }

      // Set warning active and auto-dismiss after 5 seconds
      setTeamRaceWarningActive(true);
      teamRaceWarningTimer.current = setTimeout(() => {
        setTeamRaceWarningActive(false);
      }, 5000);
    }

    // Cleanup function
    return () => {
      if (teamRaceWarningTimer.current) {
        clearTimeout(teamRaceWarningTimer.current);
      }
    };
    // Intentionally excluding teamRaceWarningActive from deps to avoid unnecessary re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitstopActive, limiterActive, enabled, isTeamRacing]);

  // Separate effect to dismiss warning when limiter is activated
  useEffect(() => {
    if (limiterActive && teamRaceWarningActive) {
      setTeamRaceWarningActive(false);
      if (teamRaceWarningTimer.current) {
        clearTimeout(teamRaceWarningTimer.current);
        teamRaceWarningTimer.current = null;
      }
    }
  }, [limiterActive, teamRaceWarningActive]);

  return useMemo(() => {
    if (!enabled) {
      return {
        showWarning: false,
        isTeamRaceWarning: false,
        warningText: '',
      };
    }

    // Team race warning takes priority
    if (teamRaceWarningActive) {
      return {
        showWarning: true,
        isTeamRaceWarning: true,
        warningText: '⚠ ACTIVATE LIMITER',
      };
    }

    // Standard warning: entering pit without limiter
    if (onPitRoad && !limiterActive) {
      return {
        showWarning: true,
        isTeamRaceWarning: false,
        warningText: '⚠ ACTIVATE LIMITER',
      };
    }

    return {
      showWarning: false,
      isTeamRaceWarning: false,
      warningText: '',
    };
  }, [enabled, teamRaceWarningActive, onPitRoad, limiterActive]);
};
