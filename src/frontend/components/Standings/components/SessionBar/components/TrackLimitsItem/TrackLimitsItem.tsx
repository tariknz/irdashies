import { memo } from 'react';
import { TrafficConeIcon } from '@phosphor-icons/react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

/** Amber from two thirds of the ceiling, red at it. Matches TrackLimitsCell. */
const WARN_FRACTION = 2 / 3;

/**
 * LMU's track-limits penalty points for the player: `0.25 / 3`.
 *
 * The form the sim's own UI uses, because the figure is meaningless without
 * the ceiling -- 0.25 says nothing until it is 0.25 of three, and three is
 * where the drive-through is served.
 *
 * The current value keeps two decimals, since the sim counts in fractions of
 * a point. The ceiling is a whole number and is rendered as one. A session
 * that has not stated a ceiling shows a dash for it rather than a zero, which
 * would read as "a penalty at nothing".
 *
 * Renders nothing at all on a sim with no such system, rather than a zero that
 * would claim the player is clean under rules that do not exist.
 */
export const TrackLimitsItem = memo(({ standalone }: SessionBarItemProps) => {
  const snapshot = useSessionBarSnapshot();
  const points = snapshot?.trackLimitsPoints;
  const max = snapshot?.trackLimitsPointsMax;

  if (points === undefined) return null;

  const tone =
    max && points >= max
      ? 'text-red-400'
      : max && points >= max * WARN_FRACTION
        ? 'text-amber-300'
        : '';

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center text-nowrap tabular-nums">
        <TrafficConeIcon />
        <span className={tone}>
          {points.toFixed(2)}
          <span className="text-white/50">/{max ? max.toFixed(0) : '–'}</span>
        </span>
      </div>
    </div>
  );
});
TrackLimitsItem.displayName = 'TrackLimitsItem';
