import { useState } from 'react';
import { useSessionName, useSessionLaps, useTelemetryValue, useTelemetryValues, useSessionQualifyingResults, useSessionPositions, useGeneralSettings } from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { useDriverIncidents, useSessionLapCount, useBrakeBias } from '../../hooks';
import { useTrackWetness } from '../../hooks/useTrackWetness';
import { useTrackTemperature } from '../../hooks/useTrackTemperature';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { useStandingsSettings, useRelativeSettings } from '../../hooks';
import { ClockIcon, ClockUserIcon, CloudRainIcon, DropIcon, RoadHorizonIcon, ThermometerIcon, TireIcon } from '@phosphor-icons/react';
import { useSessionCurrentTime } from '../../hooks/useSessionCurrentTime';
import { usePrecipitation } from '../../hooks/usePrecipitation';
import { useTotalRaceLaps } from '../../../../context/shared/useTotalRaceLaps';
import { useLapTimeHistory } from '../../../../context/LapTimesStore/LapTimesStore';

interface SessionBarProps {
  position?: 'header' | 'footer';
  variant?: 'standings' | 'relative';
}

export const SessionBar = ({ position = 'header', variant = 'standings' }: SessionBarProps) => {
  // Use settings hook directly for reactivity
  const standingsSettings = useStandingsSettings();
  const relativeSettings = useRelativeSettings();
  const generalSettings = useGeneralSettings();
  const settings = variant === 'relative' ? relativeSettings : standingsSettings;
  const effectiveBarSettings = position === 'footer' ? settings?.footerBar : settings?.headerBar;
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionName = useSessionName(sessionNum);
  const sessionLaps = useSessionLaps(sessionNum);
  const { incidentLimit, incidents } = useDriverIncidents();
  const { state, currentLap, totalLaps, time, timeTotal, timeRemaining } = useSessionLapCount();
  const brakeBias = useBrakeBias();
  const { trackWetness } = useTrackWetness();
  const { precipitation } = usePrecipitation();
  const { trackTemp, airTemp } = useTrackTemperature({
    airTempUnit: effectiveBarSettings?.airTemperature?.unit ?? 'Metric',
    trackTempUnit: effectiveBarSettings?.trackTemperature?.unit ?? 'Metric',
  });
  const localTime = useCurrentTime();
  const sessionClockTime = useSessionCurrentTime();
  const { totalRaceLaps, isFixedLapRace } = useTotalRaceLaps();
  const qualifyingResults = useSessionQualifyingResults();
  const racePositions = useSessionPositions(sessionNum);

  // Get lap time history for all cars
  const lapTimeHistory = useLapTimeHistory();

  // Get lap distance percentages for tie-breaking
  const lapDistPcts = useTelemetryValues<number[]>('CarIdxLapDistPct');

  // Cache for estimated total time to prevent continuous updates
  const [cachedTotalTime, setCachedTotalTime] = useState<{totalTime: number, leaderCarIdx: number, leaderLaps: number} | null>(null);

  // Define all possible items with their render functions
  const itemDefinitions = {
    sessionName: {
      enabled: effectiveBarSettings?.sessionName?.enabled ?? (position === 'header' ? true : false),
      render: () => <div className="flex">{sessionName}</div>,
    },
    sessionTime: {
      enabled: effectiveBarSettings?.sessionTime?.enabled ?? (position === 'header' ? true : false),
      render: () => {
        const mode = effectiveBarSettings?.sessionTime?.mode ?? 'Remaining';

        // For time-based sessions
        if (sessionLaps === 'unlimited') {
          let elapsedTime, remainingTime, totalTime;

          if (state === 4) { // active session
            elapsedTime = Math.max(0, timeTotal - timeRemaining);
            remainingTime = Math.max(0, timeRemaining);
            totalTime = timeTotal;
          } else if (state === 1) { // waiting/pre-session
            elapsedTime = time;
            remainingTime = Math.max(0, timeRemaining);
            totalTime = time + Math.max(0, timeRemaining);
          } else { // other states
            elapsedTime = timeTotal;
            remainingTime = timeTotal;
            totalTime = timeTotal;
          }

          const elapsedStr = (elapsedTime < totalTime) ? formatTime(elapsedTime, 'duration') : null;
          const remainingStr = (remainingTime < totalTime) ? formatTime(remainingTime, 'duration') : null;
          const totalStr = formatTime(totalTime, 'duration-wlabels');

          let timeStr = '';
          if (mode === 'Elapsed') {
            timeStr = elapsedStr ? `${elapsedStr} / ${totalStr}` : totalStr || '';
          } else if (mode === 'Remaining') {
            timeStr = remainingStr ? `${remainingStr} / ${totalStr}` : totalStr || '';
          }

          return timeStr ? <div className="flex justify-center">{timeStr}</div> : null;
        }

        // For lap-based races
        if (sessionName?.toLowerCase() === "race" && totalLaps) {
          // Calculate time elapsed
          const timeElapsed = state === 4 ? (timeTotal - timeRemaining) : (state === 1 ? time : 0);

          // Get overall fastest qualifying time
          const validQualifyingTimes = qualifyingResults?.map(r => r.FastestTime).filter(t => t > 0) || [];
          const fastestQualifyingTime = validQualifyingTimes.length > 0 ? Math.min(...validQualifyingTimes) : 0;

          // Find race leader (position 1 with most laps, tie-break by lap percent)
          const positionOneDrivers = racePositions?.filter(driver => driver.Position === 1) || [];
          const raceLeader = positionOneDrivers.length > 0 ? positionOneDrivers.reduce((best, current) => {
            if (!best || current.LapsComplete > best.LapsComplete) return current;
            if (current.LapsComplete === best.LapsComplete) {
              const bestPct = lapDistPcts?.[best.CarIdx] ?? 0;
              const currentPct = lapDistPcts?.[current.CarIdx] ?? 0;
              return currentPct > bestPct ? current : best;
            }
            return best;
          }) : null;

          // Calculate simple average lap time
          let avgLapTime = 0;
          if (raceLeader) {
            const leaderLapTimes = lapTimeHistory[raceLeader.CarIdx] || [];

            // Include qualifying time if <3 race laps completed
            const lapTimes = [...leaderLapTimes];
            if (raceLeader.LapsComplete < 3 && raceLeader.LastTime > 0) {
              lapTimes.push(raceLeader.LastTime);
            }

            // Simple average of all valid lap times
            const validTimes = lapTimes.filter(t => t > 0);
            if (validTimes.length > 0) {
              avgLapTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
            }
          }

          // Fallback to fastest qualifying time
          if (!avgLapTime) {
            avgLapTime = fastestQualifyingTime;
          }

          // Calculate and cache estimates
          if (avgLapTime > 0) {
            const lapsRemaining = Math.max(0, totalLaps - (raceLeader?.LapsComplete ?? 0));
            const estimatedTotalTime = timeElapsed + (lapsRemaining * avgLapTime);

            // Only update cached total time when leader changes or completes more laps
            const shouldUpdateCache = !cachedTotalTime ||
              cachedTotalTime.leaderCarIdx !== (raceLeader?.CarIdx ?? -1) ||
              cachedTotalTime.leaderLaps !== (raceLeader?.LapsComplete ?? 0);

            if (shouldUpdateCache) {
              setCachedTotalTime({
                totalTime: estimatedTotalTime,
                leaderCarIdx: raceLeader?.CarIdx ?? -1,
                leaderLaps: raceLeader?.LapsComplete ?? 0
              });
            }

            // Use cached total time for display (stable between calculations)
            const displayTotalTime = cachedTotalTime?.totalTime ?? estimatedTotalTime;
            const displayRemaining = Math.max(0, displayTotalTime - timeElapsed);

            // Display logic
            if (state === 4) {
              const elapsedStr = formatTime(timeElapsed, 'duration');
              const totalStr = formatTime(displayTotalTime, 'duration');
              const remainingStr = formatTime(displayRemaining, 'duration');

              if (mode === 'Elapsed' && elapsedStr && totalStr) {
                return <div className="flex justify-center">{`${elapsedStr} / ≈ ${totalStr}`}</div>;
              } else if (mode === 'Remaining' && remainingStr && totalStr) {
                return <div className="flex justify-center">{`${remainingStr} / ≈ ${totalStr}`}</div>;
              }
            } else {
              // Pre-race or other states
              const totalStr = formatTime(displayTotalTime, 'duration-wlabels');
              if (totalStr) {
                return <div className="flex justify-center">≈ {totalStr}</div>;
              }
            }
          }
        }

        return <div className="flex justify-center"></div>;
      },
    },
    sessionLaps: {
      enabled: effectiveBarSettings?.sessionLaps?.enabled ?? true,
      render: () => {
        if (totalRaceLaps > 0)
          if (isFixedLapRace)
            return <div className="flex justify-center">L{currentLap}/{totalRaceLaps.toFixed(0)}</div>;
          else
            return <div className="flex justify-center">L{currentLap}/{totalRaceLaps.toFixed(1)}</div>;
        else
          return <div className="flex justify-center">L{currentLap}</div>;
      },
    },
    incidentCount: {
      enabled: effectiveBarSettings?.incidentCount?.enabled ?? (position === 'header' ? true : false),
      render: () => (
        <div className="flex justify-end">
          {incidents}
          {incidentLimit ? ' / ' + incidentLimit : ''} x
        </div>
      ),
    },
    brakeBias: {
      enabled: effectiveBarSettings?.brakeBias?.enabled ?? (position === 'header' ? true : true),
      render: () => {
        if (!brakeBias || typeof brakeBias.value !== 'number' || isNaN(brakeBias.value)) return null;
        return (
          <div className="flex justify-center gap-1 items-center">
            <TireIcon />
            {brakeBias.isClio ? `${brakeBias.value.toFixed(0)}` : `${brakeBias.value.toFixed(1)}%`}
          </div>
        );
      },
    },
    localTime: {
      enabled: effectiveBarSettings?.localTime?.enabled ?? (position === 'header' ? true : true),
      render: () => (
        <div className="flex justify-center gap-1 items-center">
          <ClockUserIcon />
          <span>{localTime}</span>
        </div>
      ),
    },
    sessionClockTime: {
      enabled: effectiveBarSettings?.sessionClockTime?.enabled ?? false,
      render: () => (
        <div className="flex justify-center gap-1 items-center">
          <ClockIcon />
          <span>{sessionClockTime}</span>
        </div>
      ),
    },
    trackWetness: {
      enabled: effectiveBarSettings?.trackWetness?.enabled ?? (position === 'header' ? false : true),
      render: () => (
        <div className="flex justify-center gap-1 items-center text-nowrap">
          <DropIcon />
          <span>{trackWetness}</span>
        </div>
      ),
    },
    precipitation: {
      enabled: effectiveBarSettings?.precipitation?.enabled ?? (position === 'header' ? false : false),
      render: () => (
        <div className="flex justify-center gap-1 items-center text-nowrap">
          <CloudRainIcon />
          <span>{precipitation}</span>
        </div>
      ),
    },
    airTemperature: {
      enabled: effectiveBarSettings?.airTemperature?.enabled ?? (position === 'header' ? false : true),
      render: () => (
        <div className="flex justify-center gap-1 items-center">
          <ThermometerIcon />
          <span>{airTemp}</span>
        </div>
      ),
    },
    trackTemperature: {
      enabled: effectiveBarSettings?.trackTemperature?.enabled ?? (position === 'header' ? false : true),
      render: () => (
        <div className="flex justify-center gap-1 items-center">
          <RoadHorizonIcon />
          <span>{trackTemp}</span>
        </div>
      ),
    },
  };

  // Get display order, fallback to default order
  const displayOrder = effectiveBarSettings?.displayOrder || (position === 'header'
    ? ['sessionName', 'sessionTime', 'sessionLaps', 'localTime', 'brakeBias', 'incidentCount']
    : ['localTime', 'trackWetness', 'sessionLaps', 'airTemperature', 'trackTemperature']
  );

  // Filter and order items based on settings
  const itemsToRender = displayOrder
    .map(key => ({
      key,
      definition: itemDefinitions[key as keyof typeof itemDefinitions],
    }))
    .filter(({ definition }) => definition?.enabled)
    .map(({ key, definition }) => {
      const element = definition.render();
      if (!element) return null;
      return <div key={key}>{element}</div>;
    })
    .filter(Boolean);

  return (
    <div className={`bg-slate-900/70 text-sm px-3 py-1 flex justify-between ${!generalSettings?.compactMode ? (position === 'header' ? 'mb-3' : 'mt-3') : ''}`}>
      {itemsToRender}
    </div>
  );
};
