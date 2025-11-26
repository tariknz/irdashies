import { memo } from 'react';

interface DeltaCellProps {
  hidden?: boolean;
  delta?: number;
  lapsDown?: number;
  showDashForUndefined?: boolean;
}

export const DeltaCell = memo(({ hidden, delta, lapsDown, showDashForUndefined = false }: DeltaCellProps) => (
  <td data-column="delta" className="w-auto px-2 whitespace-nowrap text-center">
    {hidden
      ? ''
      : lapsDown && lapsDown > 0
        ? `${lapsDown}L`
        : delta !== undefined
          ? delta.toFixed(1)
          : showDashForUndefined 
            ? '-'
            : ''
    }
  </td>
));

DeltaCell.displayName = 'DeltaCell';
