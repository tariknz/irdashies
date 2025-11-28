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
  penalty?: boolean;
  slowdown?: boolean;
}

interface StatusBadgeProps {
  textColor?: string;
  borderColorClass: string;
  animate?: boolean;
  children: React.ReactNode;
  additionalClasses?: string;
}

const StatusBadge = ({ textColor = 'text-white', borderColorClass, animate, children, additionalClasses = '' }: StatusBadgeProps) => {
  const baseClasses = 'text-xs border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight';
  const animationClass = animate ? 'animate-pulse' : '';
  return (
    <span className={`${textColor} ${baseClasses} ${borderColorClass} ${animationClass} ${additionalClasses}`}>
      {children}
    </span>
  );
};

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
    repair,
    penalty,
    slowdown
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

    if (hidden || (!repair && !dnf && !penalty && !slowdown && !tow && !out && !pit && !lastPit)) {
      return (
        <td data-column="pitStatus" className="w-auto px-1 text-center">
          {''}
        </td>
      );
    }

    return (
      <td data-column="pitStatus" className="w-auto px-1 text-center flex flex-row-reverse gap-0.5">
        {penalty && (
          <StatusBadge textColor="text-orange-500" borderColorClass="border-white" additionalClasses="bg-black/80 inline-block min-w-6">
            {'\u00A0'}
          </StatusBadge>
        )}
        {slowdown && (
          <StatusBadge textColor="text-orange-500" borderColorClass="border-white" animate additionalClasses="bg-black/80 inline-block min-w-6">
            {'\u00A0'}
          </StatusBadge>
        )}
        {repair && (
          <StatusBadge textColor="text-orange-500" borderColorClass="border-white" additionalClasses="bg-black/80 items-center justify-center">
            <span className="inline-block w-[0.8em] h-[0.8em] bg-orange-500 rounded-full"/>
          </StatusBadge>
        )}
        {dnf && (
          <StatusBadge borderColorClass="border-red-500">
            DNF
          </StatusBadge>
        )}
        {tow && (
          <StatusBadge borderColorClass="border-orange-500" animate>
            TOW
          </StatusBadge>
        )}
        {out && (
          <StatusBadge borderColorClass="border-green-700">
            OUT
          </StatusBadge>
        )}
        {pit && (
          <StatusBadge borderColorClass="border-yellow-500" animate>
            PIT
          </StatusBadge>
        )}
        {lastPit && (
          <StatusBadge borderColorClass="border-yellow-500">
            L {lastPitLap}
          </StatusBadge>
        )}
      </td>
    );
  }
);

PitStatusCell.displayName = 'PitStatusCell';
