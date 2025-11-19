import { memo } from 'react';

interface PitStatusCellProps {
  hidden?: boolean;
  onPitRoad?: boolean;
  carTrackSurface?: number;
  prevCarTrackSurface?: number;
  lastPitLap?: number;
  lastLap?: number;
  currentSessionType: string;
}

export const PitStatusCell = memo(({ hidden, onPitRoad, carTrackSurface, prevCarTrackSurface, lastPitLap, lastLap, currentSessionType }: PitStatusCellProps) => (
  <td data-column="pitStatus" className="w-auto px-1 text-center">
    {hidden ? null : (((prevCarTrackSurface ?? -1) > -1) && carTrackSurface === -1 && currentSessionType == "Race" && (
    <span className="text-white text-xs border-red-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
        DNF
      </span>
    ))}
    {hidden ? null : (carTrackSurface==1 && prevCarTrackSurface != undefined && prevCarTrackSurface !== 2 && currentSessionType == "Race" && lastLap && (
      <span className="text-white animate-pulse text-xs border-orange-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
        TOW
      </span>
    ))}
    {hidden ? null : (!onPitRoad && lastPitLap && lastPitLap == lastLap && carTrackSurface != -1 && (
      <div>
              <span className="text-white text-xs border-green-700  border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
                OUT
              </span>
      </div>
    ))}
    {hidden ? null : (onPitRoad && ((carTrackSurface == 2  || (carTrackSurface === 1 && prevCarTrackSurface == 2) || (prevCarTrackSurface == undefined) || currentSessionType != "Race")) && (
      <span className="text-white animate-pulse text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              PIT
            </span>
    ))}
    {hidden ? null : (!onPitRoad && lastPitLap && lastPitLap > 1 && lastPitLap !== lastLap && carTrackSurface != -1 && (
      <div>
              <span className="text-white text-xs border-yellow-500 border-1 text-center text-nowrap px-2 m-0 leading-tight">
                L {lastPitLap}
              </span>
      </div>
    ))}
  </td>
));

PitStatusCell.displayName = 'PitStatusCell';

