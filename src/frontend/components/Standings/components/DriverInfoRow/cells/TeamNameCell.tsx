import { memo } from 'react';

interface TeamNameCellProps {
  teamName?: string;
  compactMode?: string;
}

export const TeamNameCell = memo(
  ({ teamName, compactMode }: TeamNameCellProps) => {
    const paddingClass = compactMode !== 'ultra' ? 'px-1 py-0.5' : '';
    return (
      <td data-column="teamName" className={`${paddingClass} max-w-[150px]`}>
        <div className="overflow-hidden">
          <span className="block truncate text-slate-300">{teamName}</span>
        </div>
      </td>
    );
  }
);

TeamNameCell.displayName = 'TeamNameCell';
