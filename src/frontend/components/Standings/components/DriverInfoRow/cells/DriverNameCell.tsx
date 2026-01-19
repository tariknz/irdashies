import { memo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { DriverStatusBadges } from './DriverStatusBadges';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';

interface DriverNameCellProps {
  hidden?: boolean;
  name?: string;
  fullName?: string;
  nameFormat?: DriverNameFormat;
  radioActive?: boolean;
  repair?: boolean;
  penalty?: boolean;
  slowdown?: boolean;
  showStatusBadges?: boolean;
}

export const DriverNameCell = memo(
  ({
    hidden,
    name,
    fullName,
    nameFormat,
    radioActive,
    repair,
    penalty,
    slowdown,
    showStatusBadges = true,
  }: DriverNameCellProps) => {
    const displayName = hidden
      ? ''
      : fullName
      ? formatDriverName(
          extractDriverName(fullName),
          nameFormat ?? 'name-middlename-surname'
        )
      : name ?? '';

    return (
      <td data-column="driverName" className="w-full max-w-0 px-1 py-0.5">
        <div className="flex items-center overflow-hidden">
          <span
            className={`animate-pulse transition-[width] duration-300 ${
              radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'
            }`}
          >
            <SpeakerHighIcon className="mt-px" size={16} />
          </span>

          <div className="flex-1 min-w-0 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
            <span className="block truncate">{displayName}</span>
          </div>

          {showStatusBadges && (
            <DriverStatusBadges
              hidden={hidden}
              repair={repair}
              penalty={penalty}
              slowdown={slowdown}
              className="shrink-0"
            />
          )}
        </div>
      </td>
    );
  }
);

DriverNameCell.displayName = 'DriverNameCell';
