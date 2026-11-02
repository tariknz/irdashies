import { memo } from 'react';

interface TrackLimitsCellProps {
  /** Points, not the sim's infringement steps. Undefined when unknown. */
  points?: number;
  /** Points at which a drive-through is served. 0 or undefined when unknown. */
  max?: number;
  compactMode?: string;
}

/**
 * Where the escalation starts, as a fraction of the ceiling.
 *
 * Two thresholds rather than a gradient: the number already says how close a
 * car is, and the colour is there to be caught out of the corner of an eye.
 * Amber from two thirds, red at the ceiling.
 */
const WARN_FRACTION = 2 / 3;

const toneFor = (points: number, max: number | undefined): string => {
  if (points <= 0) return 'text-white/50';
  if (!max || max <= 0) return '';
  if (points >= max) return 'text-red-400';
  if (points >= max * WARN_FRACTION) return 'text-amber-300';
  return '';
};

/**
 * LMU's track-limits penalty points for one car.
 *
 * Two decimals, matching the sim's own display and TinyPedal's: the steps are
 * fractions of a point -- quarters on a four-step scale -- so a rounded
 * integer would show a car one infringement from a drive-through as clean.
 *
 * A car with no reading renders nothing rather than 0.00, which would be an
 * assertion that it is clean when the sim has not said so.
 */
export const TrackLimitsCell = memo(
  ({ points, max, compactMode }: TrackLimitsCellProps) => {
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';

    return (
      <td
        data-column="trackLimits"
        className={`w-[2.5rem] ${pxClass} text-right align-middle whitespace-nowrap tabular-nums`}
      >
        {points === undefined ? null : (
          <span className={toneFor(points, max)}>{points.toFixed(2)}</span>
        )}
      </td>
    );
  }
);

TrackLimitsCell.displayName = 'TrackLimitsCell';
