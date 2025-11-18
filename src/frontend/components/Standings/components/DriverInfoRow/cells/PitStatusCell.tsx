import { memo } from 'react';

interface PitStatusCellProps {
  hidden?: boolean;
  onPitRoad?: boolean;
  carTrackSurface?: number;
  prevCarTrackSurface?: number;
  lastPitLap?: number;
  lastLap?: number;
}

export const PitStatusCell = memo(({ hidden, onPitRoad, carTrackSurface, prevCarTrackSurface, lastPitLap, lastLap }: PitStatusCellProps) => (
  <td data-column="pitStatus" className="w-auto px-1 text-center">
    {hidden ? null : (carTrackSurface === -1 && (
      <span className="text-white text-xs border-red-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              DNF
            </span>
    ))}
    {hidden ? null : (onPitRoad && prevCarTrackSurface !== 2 && (
      <span className="text-white animate-pulse text-xs border-orange-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              TOW
            </span>
    ))}
    {onPitRoad && prevCarTrackSurface === 2 && (
      <span className="text-white animate-pulse text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              PIT
            </span>
    )}
    {hidden ? null : (!onPitRoad && lastPitLap && lastPitLap == lastLap && (
      <div>
              <span className="text-white text-xs border-green-700  border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
                OUT
              </span>
      </div>
    ))}
    {hidden ? null : (!onPitRoad && lastPitLap && lastPitLap !== lastLap && (
      <div>
              <span className="text-white text-xs border-yellow-500 border-1 text-center text-nowrap px-2 m-0 leading-tight">
                L {lastPitLap}
              </span>
      </div>
    ))}
  </td>
));

PitStatusCell.displayName = 'PitStatusCell';

