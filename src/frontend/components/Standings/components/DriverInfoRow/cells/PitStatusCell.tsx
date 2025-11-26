import { memo } from 'react';

interface PitStatusCellProps {
  hidden?: boolean;
  onPitRoad?: boolean;
  carTrackSurface?: number;
  prevCarTrackSurface?: number;
  lastPitLap?: number;
  lastLap?: number;
  currentSessionType?: string;
  dnf?: boolean;
  repair?: boolean;
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
    dnf,
    repair
  }: PitStatusCellProps) => {
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

    if (hidden || (!repair && !dnf && !tow && !out && !pit && !lastPit)) {
      // Explicitly render empty string when the cell has no content
      return (
        <td data-column="pitStatus" className="w-auto px-1 text-center">
          {''}
        </td>
      );
    }

    return (
      <td data-column="pitStatus" className="w-auto px-1 text-center">
        {repair && (
          <div className="inline">
            <span className="text-orange-500 text-xs bg-black border-white border-1 rounded-md  items-center justify-center text-nowrap px-2 m-0 leading-tight">
              <span className="inline-block w-[0.8em] h-[0.8em] bg-orange-500 rounded-full"/>
            </span>
          </div>
        )}
        {dnf && (
          <div>
            <span className="text-white text-xs border-red-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              DNF
            </span>
          </div>
        )}
        {tow && (
          <div className="inline">
            <span className="text-white animate-pulse text-xs border-orange-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              TOW
            </span>
          </div>
        )}
        {out && (
          <div className="inline">
            <span className="text-white text-xs border-green-700  border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              OUT
            </span>
          </div>
        )}
        {pit && (
          <div className="inline">
            <span className="text-white animate-pulse text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              PIT
            </span>
          </div>
        )}
        {lastPit && (
          <div className="inline">
            <span className="text-white text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              L {lastPitLap}
            </span>
          </div>
        )}
      </td>
    );
  }
);

PitStatusCell.displayName = 'PitStatusCell';
