import { memo } from 'react';
import { TrafficConeIcon } from '@phosphor-icons/react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { formatTrackLimits, trackLimitsTone } from '../../trackLimitsDisplay';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

/**
 * LMU's track-limits penalty points for the player: `0.25 / 3.00`.
 *
 * The form the sim's own UI uses, because the figure is meaningless without
 * the ceiling -- 0.25 says nothing until it is 0.25 of three, and three is
 * where the drive-through is served. Formatting is shared with the Incident
 * Count item, which shows the same thing for LMU in place of iRacing's
 * incident counter.
 *
 * Renders nothing at all on a sim with no such system, rather than a zero that
 * would claim the player is clean under rules that do not exist.
 */
export const TrackLimitsItem = memo(({ standalone }: SessionBarItemProps) => {
  const snapshot = useSessionBarSnapshot();
  const points = snapshot?.trackLimitsPoints;
  const max = snapshot?.trackLimitsPointsMax;

  if (points === undefined) return null;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center text-nowrap tabular-nums">
        <TrafficConeIcon />
        <span className={trackLimitsTone(points, max)}>
          {formatTrackLimits(points, max)}
        </span>
      </div>
    </div>
  );
});
TrackLimitsItem.displayName = 'TrackLimitsItem';
