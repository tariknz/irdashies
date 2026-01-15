import { memo } from 'react';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';

interface DriverNameCellProps {
  hidden?: boolean;
  fullName?: string;
  nameFormat?: DriverNameFormat;
}

export const DriverNameCell = memo(
  ({ hidden, fullName, nameFormat }: DriverNameCellProps) => (
    <td data-column="driver-name" className="w-auto whitespace-nowrap">
      {hidden || !fullName ? null : (
        formatDriverName(
          extractDriverName(fullName),
          nameFormat ?? 'name-middlename-surname'
        )
      )}
    </td>
  )
);

DriverNameCell.displayName = 'DriverNameCell';

