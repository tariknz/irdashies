import { memo } from 'react';

interface VirtualEnergyCellProps {
  /**
   * Virtual energy or fuel remaining, 0..1. Undefined where neither reads.
   *
   * Which of the two it is depends on the car -- a Hypercar runs on energy, a
   * GTE on fuel -- and only one limits any given car, so one column carries
   * both. The mapper has already chosen; nothing here needs to know which.
   */
  remaining?: number;
  compactMode?: string;
}

/**
 * Where the colour turns, as a fraction remaining.
 *
 * Two steps rather than a gradient: the number says how much is left, and the
 * colour is for catching a car about to stop without reading it. TinyPedal
 * uses 30% and 10% on the same figure; LMUTraceHUB 25% and 15%. These are
 * TinyPedal's, because its thresholds sit either side of the point where a
 * stint decision stops being optional.
 */
const LOW_FRACTION = 0.3;
const CRITICAL_FRACTION = 0.1;

const toneFor = (remaining: number): string => {
  if (remaining <= CRITICAL_FRACTION) return 'text-red-400';
  if (remaining <= LOW_FRACTION) return 'text-amber-300';
  return '';
};

/**
 * What a car has left to run on, as a percentage.
 *
 * No decimals: the column is scanned down, not read, and the fuel source is
 * byte-quantised anyway -- roughly 0.4% a step -- so a decimal place would be
 * showing the quantisation rather than the fuel.
 *
 * A car with no reading renders nothing rather than 0%, which would say it is
 * empty when the sim has not said so.
 */
export const VirtualEnergyCell = memo(
  ({ remaining, compactMode }: VirtualEnergyCellProps) => {
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';

    return (
      <td
        data-column="lmuVirtualEnergy"
        className={`w-[2.5rem] ${pxClass} text-right align-middle whitespace-nowrap tabular-nums`}
      >
        {remaining === undefined ? null : (
          <span className={toneFor(remaining)}>
            {Math.round(remaining * 100)}%
          </span>
        )}
      </td>
    );
  }
);

VirtualEnergyCell.displayName = 'VirtualEnergyCell';
