import { memo, type ReactNode } from 'react';
import { formatTime } from '@irdashies/utils/time';

interface StatusBadgeProps {
  textColor?: string;
  borderColorClass: string;
  animate?: boolean;
  children: ReactNode;
  additionalClasses?: string;
}

const StatusBadge = ({
  textColor = 'text-white',
  borderColorClass,
  animate,
  children,
  additionalClasses = '',
}: StatusBadgeProps) => {
  const baseClasses =
    'text-xs border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight';
  const animationClass = animate ? 'animate-pulse' : '';

  return (
    <span
      className={`${textColor} ${baseClasses} ${borderColorClass} ${animationClass} ${additionalClasses}`}
    >
      {children}
    </span>
  );
};

interface DriverStatusBadgesProps {
  repair?: boolean;
  penalty?: boolean;
  slowdown?: boolean;
  dnf?: boolean;
  tow?: boolean;
  out?: boolean;
  lap?: number;
  pit?: boolean;
  lastPit?: boolean;
  lastPitLap?: number;
  pitStopDuration?: number | null;
  showPitTime?: boolean;
  className?: string;
  pitLapDisplayMode?: string;
  pitExitAfterSF?: boolean;
  isMinimal?: boolean;
}

export const DriverStatusBadges = memo(
  ({
    repair,
    penalty,
    slowdown,
    dnf,
    tow,
    out,
    pit,
    lap,
    lastPit,
    lastPitLap,
    pitStopDuration,
    showPitTime = false,
    className = '',
    pitLapDisplayMode,
    pitExitAfterSF,
    isMinimal,
  }: DriverStatusBadgesProps) => {
    const hasStatus =
      penalty || slowdown || repair || dnf || tow || out || pit || lastPit;

    if (!hasStatus) {
      return null;
    }

    const pitDuration = (
      <>
        {showPitTime && lastPitLap && lastPitLap > 1 && pitStopDuration && (
          <span className="text-yellow-500">
            {formatTime(pitStopDuration, 'duration')}
          </span>
        )}
      </>
    );
    let pitLap = lastPitLap;

    if (pitLapDisplayMode == 'lapsSinceLastPit') {
      if (lap && lastPitLap) {
        // On tracks where pit exit is before the S/F line (pitExitAfterSF), the
        // driver crosses S/F before completing a full out-lap. The +1 offset that
        // normally accounts for the current in-progress lap would count that tiny
        // partial lap as a full one, so we omit it in that case.
        pitLap = pitExitAfterSF ? lap - lastPitLap : lap - lastPitLap + 1;
      }
    }

    const border = isMinimal ? 'border-transparent' : undefined;

    return (
      <div
        className={`flex flex-row-reverse items-center gap-0.5 ${className}`}
      >
        {penalty && (
          <StatusBadge
            textColor="text-orange-500"
            borderColorClass={border ?? 'border-gray-500'}
            additionalClasses="bg-black/80 inline-block min-w-6"
          >
            {'\u00A0'}
          </StatusBadge>
        )}
        {slowdown && (
          <StatusBadge
            textColor="text-orange-500"
            borderColorClass={border ?? 'border-gray-500'}
            animate
            additionalClasses="bg-black/80 inline-block min-w-6"
          >
            {'\u00A0'}
          </StatusBadge>
        )}
        {repair && (
          <StatusBadge
            textColor="text-orange-500"
            borderColorClass={border ?? 'border-gray-500'}
            additionalClasses="bg-black/80 items-center justify-center"
          >
            <span className="inline-block w-[0.8em] h-[0.8em] bg-orange-500 rounded-full" />
          </StatusBadge>
        )}
        {dnf && (
          <StatusBadge borderColorClass={border ?? 'border-red-500'}>
            DNF
          </StatusBadge>
        )}
        {tow && (
          <StatusBadge borderColorClass={border ?? 'border-orange-500'} animate>
            TOW
          </StatusBadge>
        )}
        {out && (
          <StatusBadge borderColorClass={border ?? 'border-green-700'}>
            OUT {pitDuration}
          </StatusBadge>
        )}
        {pit && (
          <StatusBadge borderColorClass={border ?? 'border-yellow-500'} animate>
            PIT
          </StatusBadge>
        )}
        {lastPit && !out && (
          <StatusBadge borderColorClass={border ?? 'border-yellow-500'}>
            L {pitLap} {pitDuration}
          </StatusBadge>
        )}
      </div>
    );
  }
);

DriverStatusBadges.displayName = 'DriverStatusBadges';
