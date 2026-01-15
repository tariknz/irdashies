import { useRef } from 'react';
import { useSessionName, useSessionLaps, useTelemetryValue, useSessionQualifyingResults, useSessionDrivers, useFocusCarIdx, useSessionPositions } from '@irdashies/context';
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
  const sessionDrivers = useSessionDrivers();
  const driverCarIdx = useFocusCarIdx();
  const qualifyingResults = useSessionQualifyingResults();
  const racePositions = useSessionPositions(sessionNum);

  // Cache for estimated total time based on P1 laps completed
  const cachedTotalTime = useRef<{lapsComplete: number, totalTime: number} | null>(null);

  // Get lap time history for all cars
  const lapTimeHistory = useLapTimeHistory();

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

        // For timed sessions
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

        // For lap-limited sessions, show total laps completed
        let p1LapsComplete = 0;
        let averageLapTime = 0;
        let totalTime = 0;
        let totalTimeStr = "";
        let timeElapsed = 0;
        let timeElapsedStr = "";
        let estimatedTimeRemaining = 0;
        let estimatedTimeRemainingStr = "";
        const driverClassId = sessionDrivers?.find(driver => driver.CarIdx === driverCarIdx)?.CarClassID;

        if(sessionName?.toLowerCase() === "race") {
          // Calculate timeElapsed based on session state first
          if (state === 4) {
            timeElapsed = timeTotal - timeRemaining;
          } else if (state === 1) {
            timeElapsed = time;
          } else {
            timeElapsed = 0;
          }

          // Determine average lap time from P1's fastest 3 lap times
          if(racePositions) {
            // Find the P1 driver (position 1)
            const p1Driver = racePositions.find(result => result.Position === 1);

            if (p1Driver) {
              const p1CarIdx = p1Driver.CarIdx;
              p1LapsComplete = p1Driver.LapsComplete;

              // Get P1's race lap times from history
              const p1LapTimes = lapTimeHistory[p1CarIdx] || [];

              // Include qualifying time initially, drop after 4+ race laps
              let latestLapTimes = [...p1LapTimes];
              if (p1LapsComplete < 4 && p1Driver.LastTime > 0) {
                latestLapTimes.push(p1Driver.LastTime);
              }
              // Take the latest 5 lap times
              latestLapTimes = latestLapTimes.slice(-5);

              if (latestLapTimes.length > 0) {
                // Sort to get fastest times and take top 3
                const fastestThree = latestLapTimes.sort((a, b) => a - b).slice(0, 3);
                // Calculate average of fastest 3
                averageLapTime = fastestThree.reduce((sum, time) => sum + time, 0) / fastestThree.length;
              } else if (p1Driver.LastTime > 0) {
                // Fall back to qualifying time
                averageLapTime = p1Driver.LastTime;
              }
            }
          }

          if (!averageLapTime && qualifyingResults && (driverClassId ?? -1) >= 0) {
            // Filter results to only the driver's class and valid times (> 0)
            const classQualifyingTimes = qualifyingResults
              .filter(result => {
                const driver = sessionDrivers?.find(d => d.CarIdx === result.CarIdx);
                return driver?.CarClassID === driverClassId && result.FastestTime > 0;
              })
              .map(result => result.FastestTime);

            if (classQualifyingTimes.length > 0) {
              const fastestQualifyingTime = Math.min(...classQualifyingTimes);
              averageLapTime = fastestQualifyingTime;
            }
          }

          // Calculate estimated total time (cached per P1 lap completion)
          if(averageLapTime > 0 && totalLaps) {
            if (cachedTotalTime.current && cachedTotalTime.current.lapsComplete === p1LapsComplete) {
              totalTime = cachedTotalTime.current.totalTime;
            } else {
              if(p1LapsComplete && timeElapsed) {
                let lapsRemaining = totalLaps - p1LapsComplete;
                totalTime = (lapsRemaining * averageLapTime) + timeElapsed;
              } else {
                totalTime = totalLaps * averageLapTime;
              }
              // Cache the calculated total time
              cachedTotalTime.current = { lapsComplete: p1LapsComplete, totalTime };
            }

            totalTimeStr = formatTime(totalTime, 'duration-wlabels');
          }

          // Display based on session state
          if(timeRemaining && timeTotal && state === 4) {
            timeElapsedStr = formatTime(timeElapsed, 'duration');
            estimatedTimeRemaining = totalTime - timeElapsed;
            estimatedTimeRemainingStr = formatTime(estimatedTimeRemaining, 'duration');
            let estimatedTimeTotal = timeElapsed + estimatedTimeRemaining;
            let estimatedTimeTotalStr = formatTime(estimatedTimeTotal, 'duration');

            let progressStr = '';
            if(estimatedTimeTotal) {
              if (mode === 'Elapsed') {
                progressStr = `${timeElapsedStr} / ≈ ${estimatedTimeTotalStr}`;
              } else if (mode === 'Remaining') {
                progressStr = `${estimatedTimeRemainingStr} / ≈ ${estimatedTimeTotalStr}`;
              }
            }
            
            return <div className="flex justify-center">{progressStr}</div>;
          } else if(timeRemaining < timeTotal && state === 1) {
            timeElapsedStr = formatTime(timeElapsed, 'duration');
            let timeRemainingStr = formatTime(timeRemaining, 'duration');
            let thisTotalTime = timeElapsed + timeRemaining;
            let thisTotalTimeStr = formatTime(thisTotalTime, 'duration-wlabels');

            let thisTimeStr = `${mode === "Elapsed" ? timeElapsedStr : timeRemainingStr} / ${thisTotalTimeStr}`;

            return <div className="flex justify-content-center">{thisTimeStr}</div>
          }
        }

        return <div className="flex justify-center">{totalTimeStr ? `≈ ${totalTimeStr}` : ''}</div>;
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
    <div className={`bg-slate-900/70 text-sm px-3 py-1 flex justify-between ${position === 'header' ? 'mb-3' : 'mt-3'}`}>
      {itemsToRender}
    </div>
  );
};
