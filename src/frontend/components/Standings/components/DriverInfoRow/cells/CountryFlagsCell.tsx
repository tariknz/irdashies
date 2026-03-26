import { memo } from 'react';
import { CountryFlag } from '../../CountryFlag/CountryFlag';

interface CountryFlagsCellProps {
  flairId?: number;
  compactMode?: string;
}

export const CountryFlagsCell = memo(
  ({ flairId, compactMode }: CountryFlagsCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    return (
      <td
        data-column="countryFlags"
        className={`w-auto whitespace-nowrap ${pxClass}`}
      >
        {flairId && <CountryFlag flairId={flairId} />}
      </td>
    );
  }
);

CountryFlagsCell.displayName = 'CountryFlagsCell';
