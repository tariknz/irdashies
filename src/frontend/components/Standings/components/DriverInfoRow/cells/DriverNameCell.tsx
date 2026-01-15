import { memo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';

interface DriverNameCellProps {
  hidden?: boolean;
  fullName?: string;
  nameFormat?: DriverNameFormat;
  radioActive?: boolean;
}

export const DriverNameCell = memo(
  ({ hidden, fullName, nameFormat, radioActive }: DriverNameCellProps) => (
    <td data-column="driver-name" className="w-auto whitespace-nowrap">
      {hidden || !fullName ? null : (
        <div className="flex items-center overflow-hidden">
          <span
            className={`animate-pulse transition-[width] duration-300 ${
              radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'
            }`}
          >
            <SpeakerHighIcon className="mt-px" size={16} />
          </span>

          <span className="block truncate">
            {formatDriverName(
              extractDriverName(fullName),
              nameFormat ?? 'name-middlename-surname'
            )}
          </span>
        </div>
      )}
    </td>
  )
);


DriverNameCell.displayName = 'DriverNameCell';

