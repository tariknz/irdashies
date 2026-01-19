import { memo } from 'react';
import { DriverStatusBadges } from './DriverStatusBadges';

interface PitStatusCellProps {
  hidden?: boolean;
  onPitRoad?: boolean;
  carTrackSurface?: number;
  prevCarTrackSurface?: number;
  lastPitLap?: number;
  lastLap?: number;
  currentSessionType?: string;
  dnf?: boolean;
  pitStopDuration?: number | null;
  showPitTime?: boolean;
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
    pitStopDuration,
    showPitTime = false
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
      !onPitRoad &&
      !!lastPitLap &&
      lastPitLap > 1 &&
      carTrackSurface != -1;
    const out =
      !onPitRoad &&
      !!lastPitLap &&
      lastPitLap == lastLap &&
      carTrackSurface != -1;

    return (
      <td
        data-column="pitStatus"
        className={`${widthClass} px-1 text-center align-middle whitespace-nowrap`}
      >
        {hidden ? (
          ''
        ) : (
          <DriverStatusBadges
            hidden={hidden}
            dnf={dnf}
            tow={tow}
            pit={pit}
            out={out}
            lastPit={lastPit}
            lastPitLap={lastPitLap}
            pitStopDuration={pitStopDuration}
            showPitTime={showPitTime}
          />
        )}
      </td>
    );
  }
);

PitStatusCell.displayName = 'PitStatusCell';
