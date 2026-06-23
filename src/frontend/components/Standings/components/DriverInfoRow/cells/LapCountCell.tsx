import { memo } from 'react';

interface LapCountCellProps {
  lap?: number;
  /**
   * True when the stint lap is unknown (overlay joined mid-session, no observed
   * pit). Renders an "L-" placeholder instead of a misleading number.
   */
  unknown?: boolean;
  showBorder?: boolean;
  compactMode?: string;
}

export const LapCountCell = memo(
  ({
    lap,
    unknown = false,
    showBorder = true,
    compactMode,
  }: LapCountCellProps) => {
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';
    const showBadge = unknown || (lap !== undefined && lap > 0);

    return (
      <td
        data-column="lapCount"
        className={`w-[3rem] ${pxClass} text-center align-middle whitespace-nowrap`}
      >
        {showBadge ? (
          <span
            className={[
              'text-xs rounded-md text-center whitespace-nowrap px-2 leading-tight',
              showBorder ? 'border-2 border-slate-500' : '',
              unknown ? 'text-white/50' : '',
            ].join(' ')}
          >
            {unknown ? 'L-' : `L${lap}`}
          </span>
        ) : null}
      </td>
    );
  }
);

LapCountCell.displayName = 'LapCountCell';
