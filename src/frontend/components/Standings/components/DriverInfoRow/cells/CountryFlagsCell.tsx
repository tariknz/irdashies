import { memo } from 'react';
import { CountryFlag } from '../../CountryFlag/CountryFlag';

interface CountryFlagsCellProps {
  hidden?: boolean;
  flairId?: number;
}

export const CountryFlagsCell = memo(({ hidden, flairId }: CountryFlagsCellProps) => (
  <td data-column="countryFlags" className="w-auto pl-2 whitespace-nowrap">
    {hidden ? null : (flairId && <CountryFlag flairId={flairId} size="sm" />)}
  </td>
));

CountryFlagsCell.displayName = 'CountryFlagsCell';

