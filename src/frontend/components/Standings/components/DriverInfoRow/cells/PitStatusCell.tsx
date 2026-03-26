import { memo } from 'react';
import { DriverStatusBadges } from './DriverStatusBadges';

interface PitStatusCellProps {
  onPitRoad?: boolean;
  carTrackSurface?: number;
  prevCarTrackSurface?: number;
  lap?: number;
  lastPitLap?: number;
  lastLap?: number;
  currentSessionType?: string;
  dnf?: boolean;
  pitStopDuration?: number | null;
  showPitTime?: boolean;
  pitLapDisplayMode?: string;
  /**
   * True when the pit lane exit is in the last 15% of the lap, meaning the
   * start/finish line is reached very shortly after exiting pits. When true,
   * OUT persists for one extra lap count so it remains visible for a full lap.
   */
  pitExitAfterSF?: boolean;
}

export const PitStatusCell = memo(
  ({
    onPitRoad,
    carTrackSurface,
    prevCarTrackSurface,
    lap,
    lastPitLap,
    lastLap,
    currentSessionType,
    dnf,
    pitStopDuration,
    showPitTime = false,
    pitLapDisplayMode,
    pitExitAfterSF,
  }: PitStatusCellProps) => {
    const widthClass = showPitTime ? 'w-[7rem]' : 'w-[4.5rem]';
    const tow =
      carTrackSurface == 1 &&
      prevCarTrackSurface != undefined &&
      prevCarTrackSurface !== 2 &&
      currentSessionType == 'Race' &&
      !!lastLap;
    const pit =
      onPitRoad &&
      (carTrackSurface == 2 ||
        (carTrackSurface === 1 && prevCarTrackSurface == 2) ||
        prevCarTrackSurface == undefined ||
        currentSessionType != 'Race');
    const lastPit =
      !onPitRoad && !!lastPitLap && lastPitLap > 1 && carTrackSurface != -1;
    const out =
      !onPitRoad &&
      !!lastPitLap &&
      (lastPitLap == lastLap ||
        (!!pitExitAfterSF && lastPitLap + 1 == lastLap)) &&
      carTrackSurface != -1;

    return (
      <td
        data-column="pitStatus"
        className={`${widthClass} px-1 text-center align-middle whitespace-nowrap`}
      >
        <DriverStatusBadges
          dnf={dnf}
          tow={tow}
          pit={pit}
          out={out}
          lap={lap}
          lastPit={lastPit}
          lastPitLap={lastPitLap}
          pitStopDuration={pitStopDuration}
          showPitTime={showPitTime}
          pitLapDisplayMode={pitLapDisplayMode}
          pitExitAfterSF={pitExitAfterSF}
        />
      </td>
    );
  }
);

PitStatusCell.displayName = 'PitStatusCell';
