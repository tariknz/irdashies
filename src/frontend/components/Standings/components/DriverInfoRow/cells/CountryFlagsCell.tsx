import { memo } from 'react';
import { CountryFlag } from '../../CountryFlag/CountryFlag';

interface CountryFlagsCellProps {
  flairId?: number;
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const CountryFlagsCell = memo(
  ({
    flairId,
    compactMode,
    inRotationGroup = false,
  }: CountryFlagsCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    const content = flairId ? <CountryFlag flairId={flairId} /> : null;

    if (inRotationGroup) return content;

    return (
      <td
        data-column="countryFlags"
        className={`w-auto whitespace-nowrap ${pxClass}`}
      >
        {content}
      </td>
    );
  }
);

CountryFlagsCell.displayName = 'CountryFlagsCell';
