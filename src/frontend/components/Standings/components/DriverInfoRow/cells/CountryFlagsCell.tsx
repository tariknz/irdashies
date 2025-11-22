import { memo } from 'react';
import { CountryFlag } from '../../CountryFlag/CountryFlag';

interface CountryFlagsCellProps {
  hidden?: boolean;
  flairId?: number;
}

export const CountryFlagsCell = memo(({ hidden, flairId }: CountryFlagsCellProps) => (
  <td data-column="countryFlags" className="w-auto whitespace-nowrap px-2">
    {hidden ? null : (flairId && <CountryFlag flairId={flairId} />)}
  </td>
));

CountryFlagsCell.displayName = 'CountryFlagsCell';

