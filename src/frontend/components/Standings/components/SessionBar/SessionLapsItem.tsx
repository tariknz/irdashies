import { memo } from 'react';
import { useCurrentSessionType, useTotalRaceLaps } from '@irdashies/context';
import { SessionState, type SessionBarConfig } from '@irdashies/types';
import { useSessionLapCount } from '../../hooks';

export const SessionLapsItem = memo(
  ({ settings }: { settings?: SessionBarConfig['sessionLaps'] }) => {
    const session = useCurrentSessionType();
    const { currentLap, totalLaps, state } = useSessionLapCount();
    const { totalRaceLaps, isFixedLapRace } = useTotalRaceLaps();

    const lapDisplay = Math.max(currentLap, 0);
    const lapsTotal = session === 'Race' ? totalRaceLaps : totalLaps;
    const lapsMode = settings?.mode ?? 'Elapsed';
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

    if (state >= SessionState.Checkered) {
      return (
        <div className="flex justify-center">
          L{Math.ceil(effectiveTotal).toFixed(0)}
        </div>
      );
    }

    if (lapsTotal > 0) {
      if (isFixedLapRace) {
        return (
          <div className="flex justify-center">
            L{lapValue} / {lapsTotal.toFixed(0)}
          </div>
        );
      }
      return (
        <div className="flex justify-center">
          L{lapValue} /{' '}
          {overrun ? effectiveTotal.toFixed(0) : lapsTotal.toFixed(1)}
        </div>
      );
    }

    return <div className="flex justify-center">L{lapDisplay}</div>;
  }
);
SessionLapsItem.displayName = 'SessionLapsItem';
