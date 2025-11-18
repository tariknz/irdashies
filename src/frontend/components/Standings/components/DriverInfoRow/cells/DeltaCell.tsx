import { memo } from 'react';

interface DeltaCellProps {
  hidden?: boolean;
  delta?: number;
}

export const DeltaCell = memo(({ hidden, delta }: DeltaCellProps) => (
  <td data-column="delta" className="w-auto px-2 whitespace-nowrap text-center">
    {hidden ? '' : delta?.toFixed(1)}
  </td>
));

DeltaCell.displayName = 'DeltaCell';

