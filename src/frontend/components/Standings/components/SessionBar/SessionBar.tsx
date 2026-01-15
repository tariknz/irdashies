import { useSessionName, useSessionLaps, useTelemetryValue, useGeneralSettings } from '@irdashies/context';
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
  const { state, currentLap, time, timeTotal, timeRemaining } = useSessionLapCount();
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
        if (currentLap > 0) {
          return <div className="flex justify-center">L{currentLap}</div>;
        }

        return null;
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
