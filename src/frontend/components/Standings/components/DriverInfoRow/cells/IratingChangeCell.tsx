import { memo } from 'react';

interface IratingChangeCellProps {
  hidden?: boolean;
  iratingChange?: React.ReactNode;
}

export const IratingChangeCell = memo(({ hidden, iratingChange }: IratingChangeCellProps) => (
  <td data-column="iratingChange" className="w-auto px-2 text-center whitespace-nowrap">
    {hidden ? null : iratingChange}
  </td>
));

IratingChangeCell.displayName = 'IratingChangeCell';

