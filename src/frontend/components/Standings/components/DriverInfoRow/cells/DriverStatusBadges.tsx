import { memo, type ReactNode } from 'react';

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
  hidden?: boolean;
  repair?: boolean;
  penalty?: boolean;
  slowdown?: boolean;
  dnf?: boolean;
  tow?: boolean;
  out?: boolean;
  pit?: boolean;
  lastPit?: boolean;
  lastPitLap?: number;
  pitStopDuration?: number | null;
  showPitTime?: boolean;
  className?: string;
}

export const DriverStatusBadges = memo(
  ({
    hidden,
    repair,
    penalty,
    slowdown,
    dnf,
    tow,
    out,
    pit,
    lastPit,
    lastPitLap,
    pitStopDuration,
    showPitTime = false,
    className = '',
  }: DriverStatusBadgesProps) => {
    const hasStatus =
      !hidden &&
      (penalty || slowdown || repair || dnf || tow || out || pit || lastPit);

    if (!hasStatus) {
      return null;
    }

    return (
      <div className={`flex flex-row-reverse items-center gap-0.5 ${className}`}>
        {penalty && (
          <StatusBadge textColor="text-orange-500" borderColorClass="border-gray-500" additionalClasses="bg-black/80 inline-block min-w-6">
            {'\u00A0'}
          </StatusBadge>
        )}
        {slowdown && (
          <StatusBadge textColor="text-orange-500" borderColorClass="border-gray-500" animate additionalClasses="bg-black/80 inline-block min-w-6">
            {'\u00A0'}
          </StatusBadge>
        )}
        {repair && (
          <StatusBadge textColor="text-orange-500" borderColorClass="border-gray-500" additionalClasses="bg-black/80 items-center justify-center">
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
            OUT{showPitTime && pitStopDuration && <span className="text-green-500"> {pitStopDuration} s</span>}
          </StatusBadge>
        )}
        {pit && (
          <StatusBadge borderColorClass="border-yellow-500" animate>
            PIT
          </StatusBadge>
        )}
        {lastPit && !out && (
          <StatusBadge borderColorClass="border-yellow-500">
            L {lastPitLap}{showPitTime && <span className="text-yellow-500">{pitStopDuration && ` ${pitStopDuration} s`}</span>}
          </StatusBadge>
        )}
      </div>
    );
  }
);

DriverStatusBadges.displayName = 'DriverStatusBadges';
