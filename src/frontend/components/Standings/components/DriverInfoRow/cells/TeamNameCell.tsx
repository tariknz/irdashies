import { memo } from 'react';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../../../shared/DriverName/DriverName';

interface TeamNameCellProps {
  teamName?: string;
  driverName?: string;
  nameFormat?: DriverNameFormat;
  removeNumbersFromName?: boolean;
  fillAvailableWidth?: boolean;
  compactMode?: string;
}

export const TeamNameCell = memo(
  ({
    teamName,
    driverName,
    nameFormat,
    removeNumbersFromName = false,
    fillAvailableWidth = false,
    compactMode,
  }: TeamNameCellProps) => {
    const paddingClass = compactMode !== 'ultra' ? 'px-1 py-0.5' : '';
    const displayDriverName = driverName
      ? formatDriverName(
          extractDriverName(driverName, removeNumbersFromName),
          nameFormat ?? 'name-middlename-surname'
        )
      : undefined;
    return (
      <td
        data-column="teamName"
        className={`${paddingClass} ${fillAvailableWidth ? 'w-full max-w-0' : 'max-w-[150px]'}`}
      >
        <div className="overflow-hidden">
          <span
            className={[
              'block truncate',
              displayDriverName
                ? 'text-white text-[0.92em] leading-[1.1] font-semibold'
                : 'text-slate-300',
            ].join(' ')}
          >
            {teamName}
          </span>
          {displayDriverName && (
            <span className="block truncate text-[0.67em] leading-[1.125] text-slate-400">
              {displayDriverName}
            </span>
          )}
        </div>
      </td>
    );
  }
);

TeamNameCell.displayName = 'TeamNameCell';
