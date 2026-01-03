import { memo } from 'react';

interface DeltaCellProps {
  hidden?: boolean;
  delta?: number;
  showForUndefined?: string;
  decimalPlaces?: number;
}

export const DeltaCell = memo(({ hidden, delta, showForUndefined = "-", decimalPlaces = 2 }: DeltaCellProps) => (
  <td data-column="delta" className="w-auto px-2 whitespace-nowrap text-center">
    {hidden
      ? ''
      : delta !== undefined
        ? delta.toFixed(decimalPlaces)
        : showForUndefined
    }
  </td>
));

DeltaCell.displayName = 'DeltaCell';
