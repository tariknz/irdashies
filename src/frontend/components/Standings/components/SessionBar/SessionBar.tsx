import {
  useGeneralSettings,
  useTelemetryValue,
  useCurrentSessionType,
  useThrottledWeather,
  useTotalRaceLaps,
  useTotalRaceTime,
  useTrackDisplayName,
} from '@irdashies/context';
import {
  useDriverIncidents,
  useSessionLapCount,
  useBrakeBias,
} from '../../hooks';
import { useTrackWetness } from '../../hooks/useTrackWetness';
import { useTrackTemperature } from '../../hooks/useTrackTemperature';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import {
  ClockIcon,
  ClockUserIcon,
  CloudRainIcon,
  DropIcon,
  RoadHorizonIcon,
  ThermometerIcon,
  TireIcon,
} from '@phosphor-icons/react';
import { SessionBarConfig } from '@irdashies/types';
import { useSessionCurrentTime } from '../../hooks/useSessionCurrentTime';
import { usePrecipitation } from '../../hooks/usePrecipitation';
import { SessionState } from '@irdashies/types';
import { WindArrow } from '../../../shared/WindArrow';

// compact=true (total time): trims trailing zero components, never shows seconds
// compact=false (elapsed/remaining): always shows full HH:MM:SS
const formatTotalTime = (
  seconds: number,
  totalFormat: 'hh:mm' | 'minimal',
  compact: boolean,
  labelStyle: 'none' | 'short' | 'minimal'
): string => {
  if (seconds < 0) return '-';
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  let result: string;
  if (totalFormat === 'hh:mm') {
    if (compact && minutes === 0 && hours > 0) {
      result = String(hours).padStart(2, '0');
    } else {
      result = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      if (!compact) result += `:${String(secs).padStart(2, '0')}`;
    }
  } else {
    // minimal
    if (compact) {
      if (hours > 0) {
        if (minutes === 0) {
          result = `${hours}`;
        } else if (secs > 0) {
          result = `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
          result = `${hours}:${String(minutes).padStart(2, '0')}`;
        }
      } else {
        result =
          secs > 0
            ? `${minutes}:${String(secs).padStart(2, '0')}`
            : `${minutes}`;
      }
    } else {
      // elapsed/remaining: trim leading zero components
      if (hours > 0) {
        result = `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      } else if (minutes > 0) {
        result = `${minutes}:${String(secs).padStart(2, '0')}`;
      } else {
        result = `${secs}`;
      }
    }
  }

  if (labelStyle === 'short')
    result += hours > 0 ? ' hrs' : minutes > 0 ? ' mins' : ' secs';
  else if (labelStyle === 'minimal')
    result += hours > 0 ? ' h' : minutes > 0 ? ' m' : ' s';
  return result;
};

interface SessionBarProps {
  settings: SessionBarConfig;
  position?: 'header' | 'footer';
  standalone?: boolean;
}

export const SessionBar = ({
  settings: effectiveBarSettings,
  position = 'header',
  standalone = false,
}: SessionBarProps) => {
  const generalSettings = useGeneralSettings();

  const isUltra = generalSettings?.compactMode === 'ultra';
  const isCompact = generalSettings?.compactMode === 'compact';

  const pyClass = isUltra ? 'py-0' : isCompact ? 'py-1' : 'py-2';
  const gapClass = isUltra ? 'gap-x-2' : isCompact ? 'gap-x-4' : 'gap-x-6';
  const pxClass = standalone
    ? isUltra
      ? 'px-2'
      : isCompact
        ? 'px-3'
        : 'px-4'
    : isUltra
      ? 'px-1'
      : isCompact
        ? 'px-2'
        : 'px-3';

  const session = useCurrentSessionType();
  const displayUnits = useTelemetryValue('DisplayUnits'); // 0 = imperial, 1 = metric
  const {
    incidentLimit,
    incidents,
    incidentWarningInitialLimit,
    incidentWarningSubsequentLimit,
  } = useDriverIncidents();
  const {
    currentLap,
    time,
    timeRemaining,
    timeTotal,
    totalLaps,
    state,
    greenFlagTimestamp,
  } = useSessionLapCount();
  const brakeBias = useBrakeBias();
  const { trackWetness } = useTrackWetness();
  const { precipitation } = usePrecipitation();
  const { windDirection, windVelocity, windYaw } = useThrottledWeather();
  const relativeWindDirection = (windDirection ?? 0) - (windYaw ?? 0);
  const { trackTemp, airTemp } = useTrackTemperature({
    airTempUnit: effectiveBarSettings?.airTemperature?.unit ?? 'Metric',
    trackTempUnit: effectiveBarSettings?.trackTemperature?.unit ?? 'Metric',
  });
  const localTime = useCurrentTime();
  const sessionClockTime = useSessionCurrentTime();
  const { totalRaceLaps, isFixedLapRace } = useTotalRaceLaps();
  const { totalRaceTime, adjustedRaceTime } = useTotalRaceTime();
  const trackDisplayName = useTrackDisplayName();

  // Helper to format incident display with penalties
  const getIncidentDisplay = (
    incidents: number,
    initial: number | string | undefined,
    subsequent: number | string | undefined,
    limit: number | string | undefined
  ): string => {
    // If limit is unlimited, show infinity
    if (limit === 'unlimited' || !limit) {
      return `${incidents} / ∞ x`;
    }

    // If initial penalty >= limit, it's irrelevant (DQ happens first)
    if (
      initial &&
      initial !== 'unlimited' &&
      (initial as number) >= (limit as number)
    ) {
      initial = undefined;
    }

    // If no initial penalty configured, show basic display
    if (!initial || initial === 'unlimited') {
      return `${incidents} / ${limit} x`;
    }

    // We have initial penalty, check for subsequent
    if (!subsequent || subsequent === 'unlimited') {
      // Only initial penalty, no recurrence
      if (incidents < (initial as number)) {
        return `${incidents} / ${initial} / ${limit} x`;
      } else {
        return `${incidents} / ${limit} x`;
      }
    }

    // Full subsequent penalty tracking
    if (incidents < (initial as number)) {
      return `${incidents} / ${initial} / ${limit} x`;
    }

    const initialNum = initial as number;
    const subsequentNum = subsequent as number;

    // Which round of subsequent penalties?
    const roundsCompleted = Math.floor(
      (incidents - initialNum) / subsequentNum
    );
    const nextPenalty = initialNum + (roundsCompleted + 1) * subsequentNum;

    if (nextPenalty >= (limit as number)) {
      return `${incidents} / ${limit} x`;
    }

    return `${incidents} / ${nextPenalty} / ${limit} x`;
  };

  // Define all possible items with their render functions
  const itemDefinitions = {
    sessionName: {
      enabled:
        effectiveBarSettings?.sessionName?.enabled ??
        (position === 'header' ? true : false),
      render: () => <div className="flex">{session}</div>,
    },
    sessionTime: {
      enabled:
        effectiveBarSettings?.sessionTime?.enabled ??
        (position === 'header' ? true : false),
      render: () => {
        let elapsedTime = -1;
        let remainingTime = -1;
        let totalTime = -1;
        if (session === 'Race') {
          switch (state) {
            case SessionState.GetInCar:
              // Before grid, there is a ~2min countdown
              elapsedTime = time;
              remainingTime = timeRemaining;
              totalTime = time + timeRemaining;
              break;
            case SessionState.Warmup:
            case SessionState.ParadeLaps:
              // Freeze the race timers until green
              elapsedTime = 0;
              if (isFixedLapRace) {
                remainingTime = totalRaceTime;
                totalTime = totalRaceTime;
              } else {
                remainingTime = timeRemaining;
                totalTime = timeTotal;
              }
              break;
            case SessionState.Racing:
            case SessionState.Checkered:
              // Session timer does not restart at green
              elapsedTime = time - greenFlagTimestamp;
              if (isFixedLapRace) {
                remainingTime = adjustedRaceTime - elapsedTime;
                totalTime = totalRaceTime;
              } else {
                remainingTime = timeRemaining;
                totalTime = timeTotal;
              }
              break;
            case SessionState.CoolDown:
            default:
              elapsedTime = 0;
              remainingTime = 0;
              totalTime = 0;
              break;
          }
        } else {
          elapsedTime = time;
          remainingTime = timeRemaining;
          totalTime = timeTotal;
        }

        const sessionTimeSettings = effectiveBarSettings?.sessionTime;
        const totalFormat = sessionTimeSettings?.totalFormat ?? 'minimal';
        const labelStyle = sessionTimeSettings?.labelStyle ?? 'minimal';

        const elapsedStr =
          elapsedTime >= 0
            ? formatTotalTime(elapsedTime, totalFormat, false, labelStyle)
            : '-';
        const remainingStr =
          remainingTime >= 0
            ? formatTotalTime(remainingTime, totalFormat, false, labelStyle)
            : '-';
        let totalStr =
          totalTime >= 0
            ? formatTotalTime(totalTime, totalFormat, true, labelStyle)
            : '-';

        if (session === 'Race' && state >= 2 && isFixedLapRace) {
          totalStr = '~' + totalStr;
        }

        const mode = sessionTimeSettings?.mode ?? 'Remaining';
        if (mode === 'Remaining') {
          return (
            <div className="flex justify-center tabular-nums">
              {remainingStr} / {totalStr}
            </div>
          );
        } else {
          // mode === Elapsed
          return (
            <div className="flex justify-center tabular-nums">
              {elapsedStr} / {totalStr}
            </div>
          );
        }
      },
    },
    sessionLaps: {
      enabled: effectiveBarSettings?.sessionLaps?.enabled ?? true,
      render: () => {
        const lapDisplay = Math.max(currentLap, 0);
        const lapsTotal = session === 'Race' ? totalRaceLaps : totalLaps;
        const lapsMode = effectiveBarSettings?.sessionLaps?.mode ?? 'Elapsed';
        // Round up the total if the current lap has exceeded it
        const overrun = lapDisplay > lapsTotal;
        const effectiveTotal = overrun ? lapDisplay : lapsTotal;
        const lapValue =
          lapsMode === 'Remaining'
            ? Math.min(
                Math.max(Math.ceil(effectiveTotal) - lapDisplay + 1, 0),
                Math.ceil(effectiveTotal)
              )
            : lapDisplay;
        if (state >= SessionState.Checkered)
          return (
            <div className="flex justify-center">
              L{Math.ceil(effectiveTotal).toFixed(0)}
            </div>
          );
        if (lapsTotal > 0)
          if (isFixedLapRace)
            return (
              <div className="flex justify-center">
                L{lapValue} / {lapsTotal.toFixed(0)}
              </div>
            );
          else
            return (
              <div className="flex justify-center">
                L{lapValue} /{' '}
                {overrun ? effectiveTotal.toFixed(0) : lapsTotal.toFixed(1)}
              </div>
            );
        else return <div className="flex justify-center">L{lapDisplay}</div>;
      },
    },
    incidentCount: {
      enabled:
        effectiveBarSettings?.incidentCount?.enabled ??
        (position === 'header' ? true : false),
      render: () => (
        <div className="flex justify-end tabular-nums">
          {getIncidentDisplay(
            incidents,
            incidentWarningInitialLimit,
            incidentWarningSubsequentLimit,
            incidentLimit
          )}
        </div>
      ),
    },
    brakeBias: {
      enabled:
        effectiveBarSettings?.brakeBias?.enabled ??
        (position === 'header' ? true : true),
      render: () => {
        if (
          !brakeBias ||
          typeof brakeBias.value !== 'number' ||
          isNaN(brakeBias.value)
        )
          return null;
        return (
          <div className="flex justify-center gap-1 items-center">
            <TireIcon />
            {brakeBias.isClio
              ? `${brakeBias.value.toFixed(0)}`
              : `${brakeBias.value.toFixed(1)}%`}
          </div>
        );
      },
    },
    localTime: {
      enabled:
        effectiveBarSettings?.localTime?.enabled ??
        (position === 'header' ? true : true),
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
      enabled:
        effectiveBarSettings?.trackWetness?.enabled ??
        (position === 'header' ? false : true),
      render: () => (
        <div className="flex justify-center gap-1 items-center text-nowrap">
          <DropIcon />
          <span>{trackWetness}</span>
        </div>
      ),
    },
    precipitation: {
      enabled:
        effectiveBarSettings?.precipitation?.enabled ??
        (position === 'header' ? false : false),
      render: () => (
        <div className="flex justify-center gap-1 items-center text-nowrap">
          <CloudRainIcon />
          <span>{precipitation}</span>
        </div>
      ),
    },
    airTemperature: {
      enabled:
        effectiveBarSettings?.airTemperature?.enabled ??
        (position === 'header' ? false : true),
      render: () => (
        <div className="flex justify-center gap-1 items-center">
          <ThermometerIcon />
          <span>{airTemp}</span>
        </div>
      ),
    },
    trackTemperature: {
      enabled:
        effectiveBarSettings?.trackTemperature?.enabled ??
        (position === 'header' ? false : true),
      render: () => (
        <div className="flex justify-center gap-1 items-center">
          <RoadHorizonIcon />
          <span>{trackTemp}</span>
        </div>
      ),
    },
    trackName: {
      enabled: effectiveBarSettings?.trackName?.enabled ?? false,
      render: () => <div className="flex">{trackDisplayName}</div>,
    },
    wind: {
      enabled: effectiveBarSettings?.wind?.enabled ?? false,
      render: () => {
        const isMetric = displayUnits === 1;
        const speedPosition =
          effectiveBarSettings?.wind?.speedPosition ?? 'right';
        const speed =
          windVelocity !== undefined
            ? Math.round(windVelocity * (isMetric ? 3.6 : 2.23694))
            : '-';
        const speedEl = <span>{speed}</span>;
        const arrowEl = (
          <WindArrow
            direction={relativeWindDirection}
            className="mx-1 w-3.5 h-4"
          />
        );
        return (
          <div className="flex justify-center gap-1 items-center">
            {speedPosition === 'left' && speedEl}
            {arrowEl}
            {speedPosition === 'right' && speedEl}
          </div>
        );
      },
    },
  };

  // Get display order, fallback to default order
  const displayOrder =
    effectiveBarSettings?.displayOrder ||
    (position === 'header'
      ? [
          'sessionName',
          'sessionTime',
          'sessionLaps',
          'localTime',
          'brakeBias',
          'incidentCount',
        ]
      : [
          'localTime',
          'trackWetness',
          'sessionLaps',
          'airTemperature',
          'trackTemperature',
        ]);

  // Filter and order items based on settings
  const itemsToRender = displayOrder
    .map((key: string) => ({
      key,
      definition: (
        itemDefinitions as Record<
          string,
          { enabled: boolean; render: () => React.ReactNode }
        >
      )[key],
    }))
    .filter(({ definition }) => definition?.enabled)
    .map(
      (
        { key, definition },
        index: number,
        array: {
          key: string;
          definition: { enabled: boolean; render: () => React.ReactNode };
        }[]
      ) => {
        const element = definition.render();
        if (!element) return null;

        if (standalone) {
          const isFirst = index === 0;
          const isLast = index === array.length - 1;
          return (
            <div
              key={key}
              className={`whitespace-nowrap shrink-0 ${isFirst ? 'text-left' : isLast ? 'text-right' : 'text-center'}`}
            >
              {element}
            </div>
          );
        }

        return (
          <div key={key} className="whitespace-nowrap">
            {element}
          </div>
        );
      }
    )
    .filter(Boolean);

  return (
    <div
      className={`bg-slate-900/70 ${pxClass} ${pyClass} flex items-center text-sm ${standalone ? `w-full justify-between ${gapClass}` : 'justify-between'} ${!isCompact && !isUltra && !standalone ? (position === 'header' ? 'mb-3' : 'mt-3') : ''}`}
    >
      {itemsToRender}
    </div>
  );
};
