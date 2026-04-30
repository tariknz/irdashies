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

// Shared classes for penalty / slowdown / meatball — matches original penalty badge dimensions
const flagBadgeClasses = 'bg-black/80 inline-block min-w-6';

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
    isMinimal = false,
  }: DriverStatusBadgesProps) => {
    const muted = 'border-transparent';
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

    return (
      <div
        className={`flex flex-row-reverse items-center gap-0.5 ${className}`}
      >
        {penalty && (
          <StatusBadge
            textColor="text-orange-500"
            borderColorClass="border-gray-500"
            additionalClasses={flagBadgeClasses}
          >
            {' '}
          </StatusBadge>
        )}
        {slowdown && (
          <span
            className={`text-orange-500 text-xs border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight border-gray-500 animate-pulse ${flagBadgeClasses}`}
            style={{
              background:
                'linear-gradient(to bottom right, black calc(50% - 1px), white calc(50% + 1px))',
            }}
          >
            {' '}
          </span>
        )}
        {repair && (
          <StatusBadge
            textColor="text-orange-500"
            borderColorClass="border-gray-500"
            additionalClasses={`${flagBadgeClasses} relative`}
          >
            {' '}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-[0.8em] h-[0.8em] bg-orange-500 rounded-full" />
            </span>
          </StatusBadge>
        )}
        {dnf && (
          <StatusBadge borderColorClass={isMinimal ? muted : 'border-red-500'}>
            DNF
          </StatusBadge>
        )}
        {tow && (
          <StatusBadge
            borderColorClass={isMinimal ? muted : 'border-orange-500'}
            animate
          >
            TOW
          </StatusBadge>
        )}
        {out && (
          <StatusBadge
            borderColorClass={isMinimal ? muted : 'border-green-700'}
          >
            OUT {pitDuration}
          </StatusBadge>
        )}
        {pit && (
          <StatusBadge
            borderColorClass={isMinimal ? muted : 'border-yellow-500'}
            animate
          >
            PIT
          </StatusBadge>
        )}
        {lastPit && !out && (
          <StatusBadge
            borderColorClass={isMinimal ? muted : 'border-yellow-500'}
          >
            L {pitLap} {pitDuration}
          </StatusBadge>
        )}
      </div>
    );
  }
);

DriverStatusBadges.displayName = 'DriverStatusBadges';
