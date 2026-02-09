import { memo } from 'react';
import { CountryFlag } from '../../CountryFlag/CountryFlag';

interface CountryFlagsCellProps {
  flairId?: number;
}

export const CountryFlagsCell = memo(({ flairId }: CountryFlagsCellProps) => (
  <td data-column="countryFlags" className="w-auto whitespace-nowrap px-2">
    {flairId && <CountryFlag flairId={flairId} />}
  </td>
));

CountryFlagsCell.displayName = 'CountryFlagsCell';

