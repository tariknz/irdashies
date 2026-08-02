import { memo } from 'react';
import {
  useCurrentSessionType,
  useSessionTimeTiming,
} from '@irdashies/context';
import { SessionState } from '@irdashies/types';
import { formatTotalTime } from '../../formatTotalTime';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const SessionTimeItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const session = useCurrentSessionType();
    const {
      time,
      timeRemaining,
      timeTotal,
      state,
      greenFlagTimestamp,
      isFixedLapRace,
      totalRaceTime,
      adjustedRaceTime,
    } = useSessionTimeTiming();

    let elapsedTime: number;
    let remainingTime: number;
    let totalTime: number;
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

    const sessionTimeSettings = settings?.sessionTime;
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

    return (
      <div className={sessionBarItemWrapperClass(standalone)}>
        <div className="flex justify-center tabular-nums">
          {mode === 'Remaining'
            ? `${remainingStr} / ${totalStr}`
            : `${elapsedStr} / ${totalStr}`}
        </div>
      </div>
    );
  }
);
SessionTimeItem.displayName = 'SessionTimeItem';
