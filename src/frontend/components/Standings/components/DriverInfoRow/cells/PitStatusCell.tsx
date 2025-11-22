import { memo } from 'react';

interface PitStatusCellProps {
  hidden?: boolean;
  onPitRoad?: boolean;
  carTrackSurface?: number;
  prevCarTrackSurface?: number;
  lastPitLap?: number;
  lastLap?: number;
  currentSessionType?: string;
}

export const PitStatusCell = memo(
  ({
    hidden,
    onPitRoad,
    carTrackSurface,
    prevCarTrackSurface,
    lastPitLap,
    lastLap,
    currentSessionType,
  }: PitStatusCellProps) => {
    const dnf =
      (prevCarTrackSurface ?? -1) > -1 &&
      carTrackSurface === -1 &&
      currentSessionType == 'Race';
    const tow =
      carTrackSurface == 1 &&
      prevCarTrackSurface != undefined &&
      prevCarTrackSurface !== 2 &&
      currentSessionType == 'Race' &&
      lastLap;
    const out =
      !onPitRoad &&
      lastPitLap &&
      lastPitLap == lastLap &&
      carTrackSurface != -1;
    const pit =
      onPitRoad &&
      (carTrackSurface == 2 ||
        (carTrackSurface === 1 && prevCarTrackSurface == 2) ||
        prevCarTrackSurface == undefined ||
        currentSessionType != 'Race');
    const lastPit =
      !onPitRoad &&
      lastPitLap &&
      lastPitLap > 1 &&
      lastPitLap !== lastLap &&
      carTrackSurface != -1;

    if (hidden || (!dnf && !tow && !out && !pit && !lastPit)) {
      // Explicitly render empty string when the cell has no content
      return (
        <td data-column="pitStatus" className="w-auto px-1 text-center">
          {''}
        </td>
      );
    }

    return (
      <td data-column="pitStatus" className="w-auto px-1 text-center">
        {dnf && (
          <span className="text-white text-xs border-red-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
            DNF
          </span>
        )}
        {tow && (
          <span className="text-white animate-pulse text-xs border-orange-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
            TOW
          </span>
        )}
        {out && (
          <div>
            <span className="text-white text-xs border-green-700  border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              OUT
            </span>
          </div>
        )}
        {pit && (
          <span className="text-white animate-pulse text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
            PIT
          </span>
        )}
        {lastPit && (
          <div>
            <span className="text-white text-xs border-yellow-500 border text-center text-nowrap px-2 m-0 leading-tight">
              L {lastPitLap}
            </span>
          </div>
        )}
      </td>
    );
  }
);

PitStatusCell.displayName = 'PitStatusCell';
