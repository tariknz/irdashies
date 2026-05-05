import { memo } from 'react';
import {
  useCurrentSessionType,
  useTotalRaceLaps,
  useTotalRaceTime,
} from '@irdashies/context';
import { SessionState, type SessionBarConfig } from '@irdashies/types';
import { useSessionLapCount } from '../../hooks';

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

interface SessionTimeItemProps {
  settings?: SessionBarConfig['sessionTime'];
}

export const SessionTimeItem = memo(({ settings }: SessionTimeItemProps) => {
  const session = useCurrentSessionType();
  const { time, timeRemaining, timeTotal, state, greenFlagTimestamp } =
    useSessionLapCount();
  const { totalRaceTime, adjustedRaceTime } = useTotalRaceTime();
  const { isFixedLapRace } = useTotalRaceLaps();

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

  const totalFormat = settings?.totalFormat ?? 'minimal';
  const labelStyle = settings?.labelStyle ?? 'minimal';

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

  const mode = settings?.mode ?? 'Remaining';
  if (mode === 'Remaining') {
    return (
      <div className="flex justify-center tabular-nums">
        {remainingStr} / {totalStr}
      </div>
    );
  }
  return (
    <div className="flex justify-center tabular-nums">
      {elapsedStr} / {totalStr}
    </div>
  );
});
SessionTimeItem.displayName = 'SessionTimeItem';
