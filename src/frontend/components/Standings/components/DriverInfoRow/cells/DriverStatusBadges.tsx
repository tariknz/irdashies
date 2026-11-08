import { memo, type ReactNode } from 'react';
import {
  lmuPenaltyBadgeText,
  type LmuFinishState,
  type LmuPenaltyKind,
} from '@irdashies/types';
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

/** The black squares of a 5 x 4 checkered flag, one unit each. */
const CHECKERED_SQUARES = Array.from({ length: 20 }, (_, i) => ({
  x: i % 5,
  y: Math.floor(i / 5),
})).filter(({ x, y }) => (x + y) % 2 === 0);

/**
 * The finished car's checkered flag, as a badge of its own.
 *
 * Drawn here rather than taken from Phosphor, an exception to the icon rule
 * in AGENTS.md: Phosphor's FlagCheckered is not visible enough at badge size.
 *
 * As tall as a DT or SG badge beside it, whose colour fills its 2px border
 * too: StatusBadge's line height plus that border. So the flag matches the
 * badges and the row keeps its height.
 */
const CheckeredFlagBadge = () => (
  <span className="inline-flex text-xs leading-tight">
    <svg
      viewBox="0 0 5 4"
      className="h-[calc(1.25em+4px)] w-auto"
      role="img"
      aria-label="Finished"
      data-testid="finish-flag"
    >
      <rect width="5" height="4" fill="white" />
      {CHECKERED_SQUARES.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="black" />
      ))}
    </svg>
  </span>
);

interface DriverStatusBadgesProps {
  /**
   * LMU's penalty, by kind: `DT` for a drive-through, `SG` for a stop-go,
   * `TIME` for seconds added at the next stop.
   *
   * Its own prop rather than another boolean, because the kind is the point --
   * the three cost very different amounts of time and only two of them are
   * served on track, so a single penalty flag would make the driver look up to
   * find out which.
   */
  penaltyKind?: LmuPenaltyKind;
  /**
   * Seconds a time penalty will add, for the `TIME` kind. Ignored for the
   * other two, which are served on track rather than paid in time.
   */
  penaltySeconds?: number;
  /**
   * LMU's finish status. A finished car gets a checkered flag, as iRacing
   * shows one, beside any penalty badge it still carries. DNF and DQ are
   * written out in the penalty badge's style and take its place: once a car
   * is out, a penalty has nothing left to say.
   */
  finishState?: LmuFinishState;
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
    penaltyKind,
    penaltySeconds,
    finishState,
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
    // A car that is out says so in the penalty badge's place: once it is
    // out, a penalty has nothing left to say.
    const redBadgeText =
      finishState === 'DNF' || finishState === 'DQ'
        ? finishState
        : penaltyKind && lmuPenaltyBadgeText(penaltyKind, penaltySeconds);
    const hasStatus =
      finishState ||
      penaltyKind ||
      penalty ||
      slowdown ||
      repair ||
      dnf ||
      tow ||
      out ||
      pit ||
      lastPit;

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
        {/* First, so the reversed row draws it rightmost and a penalty
            badge keeps its own place beside it. */}
        {finishState === 'FINISHED' && <CheckeredFlagBadge />}
        {redBadgeText && (
          <StatusBadge
            textColor="text-white"
            borderColorClass="border-transparent"
            // An exact red, as specified for the penalty badge: Tailwind's
            // red-500 is #ef4444.
            additionalClasses="inline-block min-w-6 font-bold bg-[#FF0000]"
          >
            {redBadgeText}
          </StatusBadge>
        )}
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
