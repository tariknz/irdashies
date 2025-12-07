import { memo } from 'react';

interface DeltaCellProps {
  hidden?: boolean;
  delta?: number;
  showDashForUndefined?: boolean;
}

export const DeltaCell = memo(({ hidden, delta, showDashForUndefined = false }: DeltaCellProps) => (
  <td data-column="delta" className="w-auto px-2 whitespace-nowrap text-center">
    {hidden
      ? ''
      : delta !== undefined
        ? delta.toFixed(1)
        : showDashForUndefined
          ? '-'
          : ''
    }
  </td>
));

DeltaCell.displayName = 'DeltaCell';
