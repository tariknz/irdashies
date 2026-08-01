import { memo } from 'react';
import {
  useCurrentSessionType,
  useSessionLapsTiming,
} from '@irdashies/context';
import { SessionState } from '@irdashies/types';
import { formatLapTotal } from '../../formatLapTotal';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const SessionLapsItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const session = useCurrentSessionType();
    const { currentLap, totalLaps, state, totalRaceLaps, isFixedLapRace } =
      useSessionLapsTiming();

    const lapDisplay = Math.max(currentLap, 0);
    const lapsTotal = session === 'Race' ? totalRaceLaps : totalLaps;
    const lapsMode = settings?.sessionLaps?.mode ?? 'Elapsed';
    // Round up the total if the current lap has exceeded it
    const overrun = lapDisplay > lapsTotal && session === 'Race';
    const effectiveTotal = overrun ? lapDisplay : lapsTotal;
    const lapValue =
      lapsMode === 'Remaining'
        ? Math.min(
            Math.max(Math.ceil(effectiveTotal) - lapDisplay + 1, 0),
            Math.ceil(effectiveTotal)
          )
        : lapDisplay;

    let content: React.ReactNode;
    if (state >= SessionState.Checkered) {
      content = <>L{Math.ceil(effectiveTotal).toFixed(0)}</>;
    } else if (lapsTotal > 0) {
      content = isFixedLapRace ? (
        <>
          L{lapValue} / {lapsTotal.toFixed(0)}
        </>
      ) : (
        <>
          L{lapValue} /{' '}
          {overrun ? effectiveTotal.toFixed(0) : formatLapTotal(lapsTotal)}
        </>
      );
    } else {
      content = <>L{lapDisplay}</>;
    }

    return (
      <div className={sessionBarItemWrapperClass(standalone)}>
        <div className="flex justify-center">{content}</div>
      </div>
    );
  }
);
SessionLapsItem.displayName = 'SessionLapsItem';
