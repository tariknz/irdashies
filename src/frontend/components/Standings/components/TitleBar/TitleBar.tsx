import {
  useCurrentSessionType,
  useTotalRaceLaps,
  useTelemetryValue,
  useWeekendInfoSeriesID,
} from '@irdashies/context';
import { SessionState } from '@irdashies/types';
import { useMemo } from 'react';
import { seriesMapping } from '../../../../utils/seriesMapping';
import { useHighlightColor } from '../../hooks/useHighlightColor';
import { useSessionLapCount } from '../../hooks/useSessionLapCount';

interface TitleBarProps {
  titleBarSettings?: { enabled: boolean; progressBar: { enabled: boolean } };
}

export const TitleBar = ({ titleBarSettings }: TitleBarProps) => {
  const seriesId = useWeekendInfoSeriesID();
  const sessionType = useCurrentSessionType();

  // Use series name if available, otherwise fall back to session type
  const displayText = seriesId
    ? seriesMapping[seriesId.toString()] || sessionType
    : sessionType || 'Unknown Session';

  const { state: sessionState, currentLap } = useSessionLapCount();
  const { totalRaceLaps } = useTotalRaceLaps();
  const lapDistPct = useTelemetryValue('LapDistPct');

  // Get highlight color from dashboard settings
  const highlightColor = useHighlightColor();

  // Computed colors for gradient stripes
  const r = (highlightColor >> 16) & 255;
  const g = (highlightColor >> 8) & 255;
  const b = highlightColor & 255;
  const color1 = `rgba(${r}, ${g}, ${b}, 1)`;
  const color2 = `rgba(${r}, ${g}, ${b}, 0.9)`;

  const progressPercentage = useMemo(() => {
    // Once checkered flag waves or cool-down begins, race is complete
    if (sessionState >= SessionState.Checkered) return 100;

    // Only calculate progress for racing sessions
    if (sessionType !== 'Race') return 0;

    // Before racing starts (warmup, parade laps)
    if (sessionState < SessionState.Racing) return 0;

    // Hooks still initializing or timed race with no lap estimate yet
    if (totalRaceLaps <= 0) return 0;

    // currentLap is 1-indexed: currentLap - 1 = completed laps
    const completedLaps = Math.max(0, currentLap - 1);
    const currentLapProgress = Math.max(0, Math.min(1, lapDistPct ?? 0));
    const totalProgress = (completedLaps + currentLapProgress) / totalRaceLaps;

    return Math.min(100, Math.max(0, totalProgress * 100));
  }, [sessionState, sessionType, currentLap, lapDistPct, totalRaceLaps]);

  // Don't render title bar if disabled in settings
  if (!titleBarSettings?.enabled) {
    return null;
  }

  return (
    <div className="relative bg-slate-900/70 text-sm px-3 py-2 flex justify-center items-center">
      {/* Background progress bar - only show for racing sessions and if enabled in settings */}
      {sessionType === 'Race' &&
        progressPercentage > 0 &&
        titleBarSettings?.progressBar?.enabled && (
          <div className="absolute inset-x-3 inset-y-2">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${progressPercentage}%`,
                backgroundImage: `repeating-linear-gradient(-45deg, ${color1} 0px, ${color1} 10px, ${color2} 10px, ${color2} 20px)`,
              }}
            />
          </div>
        )}

      {/* Centered series/session name text */}
      <div className="relative z-10 font-medium">{displayText}</div>
    </div>
  );
};
