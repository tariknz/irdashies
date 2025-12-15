import { memo } from 'react';

interface DeltaCellProps {
  hidden?: boolean;
  delta?: number;
  showForUndefined?: string;
}

export const DeltaCell = memo(({ hidden, delta, showForUndefined = "-" }: DeltaCellProps) => (
  <td data-column="delta" className="w-auto px-2 whitespace-nowrap text-center">
    {hidden
      ? ''
      : delta !== undefined
        ? delta.toFixed(1)
        : showForUndefined
    }
  </td>
));

DeltaCell.displayName = 'DeltaCell';
