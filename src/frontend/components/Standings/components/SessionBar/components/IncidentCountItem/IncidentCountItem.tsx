import { memo } from 'react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { getIncidentDisplay } from '../../getIncidentDisplay';
import { formatTrackLimits, trackLimitsTone } from '../../trackLimitsDisplay';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

/**
 * The driver's standing with the stewards, in whichever system the sim runs.
 *
 * iRacing counts incident points against a session limit and reads `4x` or
 * `4 / 17x`. LMU has no such counter -- it accumulates track-limit
 * infringements towards a drive-through and reads `0.25 / 3.00`. Showing
 * iRacing's form for LMU meant a permanent `0 / ∞ x`, which said the driver
 * was clean under rules that do not exist and could never move.
 *
 * Keyed on the data rather than on which simulator is running: track-limits
 * points are present exactly when the sim reports them, so the item follows
 * the reading it has instead of a flag it would have to keep in step. A sim
 * with neither falls through to iRacing's form, which is where it started.
 */
export const IncidentCountItem = memo(({ standalone }: SessionBarItemProps) => {
  const snapshot = useSessionBarSnapshot();
  const {
    incidentLimit,
    incidents,
    incidentWarningInitialLimit,
    incidentWarningSubsequentLimit,
  } = snapshot ?? { incidents: 0 };
  const points = snapshot?.trackLimitsPoints;
  const max = snapshot?.trackLimitsPointsMax;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-end tabular-nums">
        {points === undefined ? (
          getIncidentDisplay(
            incidents,
            incidentWarningInitialLimit,
            incidentWarningSubsequentLimit,
            incidentLimit
          )
        ) : (
          <span className={trackLimitsTone(points, max)}>
            {formatTrackLimits(points, max)}
          </span>
        )}
      </div>
    </div>
  );
});
IncidentCountItem.displayName = 'IncidentCountItem';
