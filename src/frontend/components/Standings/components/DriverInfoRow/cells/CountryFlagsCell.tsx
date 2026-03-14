import { memo } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import { CountryFlag } from '../../CountryFlag/CountryFlag';

interface CountryFlagsCellProps {
  flairId?: number;
}

export const CountryFlagsCell = memo(({ flairId }: CountryFlagsCellProps) => {
  const compactMode = useGeneralSettings()?.compactMode;
  const pxClass =
    compactMode === 'ultra' ? '' : compactMode === 'compact' ? 'px-1' : 'px-2';
  return (
    <td
      data-column="countryFlags"
      className={`w-auto whitespace-nowrap ${pxClass}`}
    >
      {flairId && <CountryFlag flairId={flairId} />}
    </td>
  );
});

CountryFlagsCell.displayName = 'CountryFlagsCell';
