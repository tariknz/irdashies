import { memo } from 'react';

interface TeamNameCellProps {
  teamName?: string;
}

export const TeamNameCell = memo(({ teamName }: TeamNameCellProps) => (
  <td
    data-column="teamName"
    className="px-1 py-0.5 max-w-[150px]"
  >
    <div className="overflow-hidden">
      <span className="block truncate text-slate-300">
        {teamName}
      </span>
    </div>
  </td>
));

TeamNameCell.displayName = 'TeamNameCell';
