import { memo } from 'react';
import { CountryFlag } from '../../../../shared/CountryFlag/CountryFlag';

interface CountryFlagsCellProps {
  flairId?: number;
  /** ISO alpha-2 from a sim that names the country outright, e.g. LMU. */
  countryCode?: string;
  compactMode?: string;
}

export const CountryFlagsCell = memo(
  ({ flairId, countryCode, compactMode }: CountryFlagsCellProps) => {
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
        {(countryCode || flairId) && (
          <CountryFlag flairId={flairId ?? 0} countryCode={countryCode} />
        )}
      </td>
    );
  }
);

CountryFlagsCell.displayName = 'CountryFlagsCell';
