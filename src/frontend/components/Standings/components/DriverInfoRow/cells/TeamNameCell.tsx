import { memo } from 'react';

interface TeamNameCellProps {
  teamName?: string;
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const TeamNameCell = memo(
  ({ teamName, compactMode, inRotationGroup = false }: TeamNameCellProps) => {
    const paddingClass = compactMode !== 'ultra' ? 'px-1 py-0.5' : '';

    const content = (
      <div
        className={`overflow-hidden ${inRotationGroup ? 'w-full h-full flex items-center justify-center' : ''}`}
      >
        <span className="block truncate text-slate-300">{teamName}</span>
      </div>
    );

    if (inRotationGroup) return content;

    return (
      <td data-column="teamName" className={`${paddingClass} max-w-[150px]`}>
        {content}
      </td>
    );
  }
);

TeamNameCell.displayName = 'TeamNameCell';
