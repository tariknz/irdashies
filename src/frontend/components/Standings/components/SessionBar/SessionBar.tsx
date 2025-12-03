import { useSessionName, useSessionLaps, useTelemetryValue } from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { useDriverIncidents, useSessionLapCount, useBrakeBias } from '../../hooks';
import { useTrackWetness } from '../../hooks/useTrackWetness';
import { useTrackTemperature } from '../../hooks/useTrackTemperature';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { useStandingsSettings, useRelativeSettings } from '../../hooks';
import { ClockIcon, DropIcon, RoadHorizonIcon, ThermometerIcon, TireIcon } from '@phosphor-icons/react';
import type { StandingsWidgetSettings, RelativeWidgetSettings } from '../../../Settings/types';

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
  const { total, current, timeElapsed, timeRemaining } = useSessionLapCount();
  const brakeBias = useBrakeBias();
  const { trackWetness } = useTrackWetness();
  const { trackTemp, airTemp } = useTrackTemperature();
  const time = useCurrentTime();

  // Define all possible items with their render functions
  const itemDefinitions = {
    sessionName: {
      enabled: effectiveBarSettings?.sessionName?.enabled ?? (position === 'header' ? true : false),
      render: () => <div className="flex">{sessionName}</div>,
    },
    timeRemaining: {
      enabled: effectiveBarSettings?.timeRemaining?.enabled ?? (position === 'header' ? true : false),
      render: () => {
        // For timed sessions, show elapsed / total
        if (sessionLaps === 'unlimited') {
          const elapsed = formatTime(timeElapsed, 'duration');
          const remaining = formatTime(timeRemaining, 'duration-wlabels');
          const timeStr = elapsed ? `${elapsed} / ${remaining}` : remaining || '';
          return timeStr ? <div className="flex justify-center">{timeStr}</div> : null;
        }

        // For lap-limited sessions, show total laps completed
        if (current > 0) {
          return <div className="flex justify-center">L{current}</div>;
        }

        return null;
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
          <ClockIcon />
          <span>{time}</span>
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
    ? ['sessionName', 'timeRemaining', 'localTime', 'brakeBias', 'incidentCount']
    : ['localTime', 'trackWetness', 'airTemperature', 'trackTemperature']
  );

  // Filter and order items based on settings
  const itemsToRender = displayOrder
    .map(key => ({
      key,
      definition: itemDefinitions[key as keyof typeof itemDefinitions],
    }))
    .filter(({ definition }) => definition?.enabled)
    .map(({ definition }) => definition.render())
    .filter(Boolean);

  return (
    <div className={`bg-slate-900/70 text-sm px-3 py-1 flex justify-between ${position === 'header' ? 'mb-3' : 'mt-3'}`}>
      {itemsToRender}
    </div>
  );
};
