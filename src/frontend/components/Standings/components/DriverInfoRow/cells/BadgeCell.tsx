import { memo } from 'react';

interface BadgeCellProps {
  hidden?: boolean;
  badge?: React.ReactNode;
}

export const BadgeCell = memo(({ hidden, badge }: BadgeCellProps) => (
  <td data-column="badge" className="w-auto whitespace-nowrap text-center">
    {hidden ? null : badge}
  </td>
));

BadgeCell.displayName = 'BadgeCell';

