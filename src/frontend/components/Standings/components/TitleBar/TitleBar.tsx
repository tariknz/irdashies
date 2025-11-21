import { useSessionName, useTelemetryValue, useWeekendInfoSeriesID } from '@irdashies/context';
import { useDashboard } from '@irdashies/context';
import { useMemo } from 'react';
import { seriesMapping } from '../../../../utils/seriesMapping';

interface TitleBarProps {
  titleBarSettings?: { enabled: boolean; progressBar: { enabled: boolean } };
}

export const TitleBar = ({ titleBarSettings }: TitleBarProps) => {
  const sessionNum = useTelemetryValue('SessionNum');
  const seriesId = useWeekendInfoSeriesID();
  const sessionName = useSessionName(sessionNum);

  // Use series name if available, otherwise fall back to session name
  const displayText = seriesId ? (seriesMapping[seriesId.toString()] || sessionName) : (sessionName || 'Unknown Session');

  // Get telemetry data for progress calculation
  const sessionTimeRemain = useTelemetryValue('SessionTimeRemain');
  const sessionTimeTotal = useTelemetryValue('SessionTimeTotal');
  const sessionLapsTotal = useTelemetryValue('SessionLapsTotal');
  const raceLaps = useTelemetryValue('RaceLaps');
  const lapDistPct = useTelemetryValue('LapDistPct');

  // Get highlight color from dashboard
  const { currentDashboard } = useDashboard();
  const highlightColor = currentDashboard?.generalSettings?.highlightColor ?? 960745;

  // Computed colors for gradient stripes
  const r = (highlightColor >> 16) & 255;
  const g = (highlightColor >> 8) & 255;
  const b = highlightColor & 255;
  const color1 = `rgba(${r}, ${g}, ${b}, 1)`;
  const color2 = `rgba(${r}, ${g}, ${b}, 0.9)`;

  const progressPercentage = useMemo(() => {
    // Only calculate progress for racing sessions
    if (sessionName !== "Race" || !sessionTimeRemain || !sessionTimeTotal || !raceLaps) {
      return 0;
    }

    const isUnlimitedLaps = !sessionLapsTotal || sessionLapsTotal === 32767; // 32767 seems to indicate unlimited

    if (isUnlimitedLaps) {
      // Time-based calculation for unlimited lap sessions
      const remainingPct = (sessionTimeRemain / sessionTimeTotal) * 100;
      const progressPct = Math.min(100, Math.max(0, 100 - remainingPct));
      return progressPct;
    } else {
      // Lap-based calculation for fixed lap sessions
      if (raceLaps === 0 && (lapDistPct || 0) < 1) {
        // Haven't completed any laps and still on first lap
        return 0;
      }

      const completedLaps = raceLaps || 0;
      const currentLapProgress = Math.max(0, Math.min(100, (lapDistPct || 0) * 100)) / 100;

      const totalProgress = (completedLaps / sessionLapsTotal) + (currentLapProgress / sessionLapsTotal);
      const progressPct = Math.min(100, Math.max(0, totalProgress * 100));

      return progressPct;
    }
  }, [sessionName, sessionTimeRemain, sessionTimeTotal, sessionLapsTotal, raceLaps, lapDistPct]);

  // Don't render title bar if disabled in settings
  if (!titleBarSettings?.enabled) {
    return null;
  }

  return (
    <div className="relative bg-slate-900/70 text-sm px-3 py-2 flex justify-center items-center">
      {/* Background progress bar - only show for racing sessions and if enabled in settings */}
      {sessionName === "Race" && progressPercentage > 0 && titleBarSettings?.progressBar?.enabled && (
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
      <div className="relative z-10 font-medium">
        {displayText}
      </div>
    </div>
  );
};
