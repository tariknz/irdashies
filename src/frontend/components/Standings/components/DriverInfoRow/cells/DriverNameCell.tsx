import { memo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';

interface DriverNameCellProps {
  hidden?: boolean;
  name: string;
  radioActive?: boolean;
}

export const DriverNameCell = memo(({ hidden, name, radioActive }: DriverNameCellProps) => (
  <td
    data-column="driverName"
    className="w-full max-w-0 px-2 py-0.5"
  >
    <div className="flex items-center overflow-hidden">
      <span
        className={`animate-pulse transition-[width] duration-300 ${radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'}`}
      >
        <SpeakerHighIcon className="mt-px" size={16} />
      </span>
      <div className="flex-1 min-w-0 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
        <span className="block truncate">{hidden ? '' : name}</span>
      </div>
    </div>
  </td>
));

DriverNameCell.displayName = 'DriverNameCell';

