import { memo } from 'react';

interface TeamNameCellProps {
  hidden?: boolean;
  teamName?: string;
}

export const TeamNameCell = memo(({ hidden, teamName }: TeamNameCellProps) => (
  <td
    data-column="teamName"
    className="px-1 py-0.5 max-w-[150px]"
  >
    <div className="overflow-hidden">
      <span className="block truncate text-slate-300">
        {hidden ? '' : teamName}
      </span>
    </div>
  </td>
));

TeamNameCell.displayName = 'TeamNameCell';
