import { memo } from 'react';

interface LapCountCellProps {
  lap?: number;
  showBorder?: boolean;
  compactMode?: string;
}

export const LapCountCell = memo(
  ({ lap, showBorder = true, compactMode }: LapCountCellProps) => {
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';

    return (
      <td
        data-column="lapCount"
        className={`w-auto ${pxClass} text-center align-middle whitespace-nowrap`}
      >
        {lap !== undefined && lap > 0 ? (
          <span
            className={[
              'text-xs rounded-md text-center whitespace-nowrap px-2 leading-tight',
              showBorder ? 'border-2 border-slate-500' : '',
            ].join(' ')}
          >
            L{lap}
          </span>
        ) : null}
      </td>
    );
  }
);

LapCountCell.displayName = 'LapCountCell';
