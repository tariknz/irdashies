import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';

interface TeamNameCellProps {
  teamName?: string;
}

export const TeamNameCell = memo(({ teamName }: TeamNameCellProps) => {
  const compactMode = useGeneralSettings()?.compactMode;
  const paddingClass = compactMode !== 'ultra' ? 'px-1 py-0.5' : '';
  return (
    <td data-column="teamName" className={`${paddingClass} max-w-[150px]`}>
      <div className="overflow-hidden">
        <span className="block truncate text-slate-300">{teamName}</span>
      </div>
    </td>
  );
});

TeamNameCell.displayName = 'TeamNameCell';
