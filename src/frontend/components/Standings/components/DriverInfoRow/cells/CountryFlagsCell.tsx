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
        {/*
          Unguarded on purpose. `(countryCode || flairId) && ...` rendered the
          *number* 0 into the cell whenever a driver had neither -- which is
          every AI under LMU, since it has no nationality and no flair id. A
          falsy non-boolean left of `&&` reaches the DOM as text.

          CountryFlag returns null when it cannot draw a flag, so the decision
          belongs there: it is the only place that knows whether the sheet has
          a cell for the code.
        */}
        <CountryFlag flairId={flairId ?? 0} countryCode={countryCode} />
      </td>
    );
  }
);

CountryFlagsCell.displayName = 'CountryFlagsCell';
