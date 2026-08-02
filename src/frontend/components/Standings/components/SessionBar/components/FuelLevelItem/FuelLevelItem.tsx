import { memo } from 'react';
import { GasPumpIcon } from '@phosphor-icons/react';
import { useTelemetryValue } from '@irdashies/context';
import { formatFuel } from '../../../../../FuelCalculator/fuelCalculations';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const FuelLevelItem = memo(({ standalone }: SessionBarItemProps) => {
  const fuelLevelLiters = useTelemetryValue('FuelLevel');
  const displayUnits = useTelemetryValue('DisplayUnits');

  if (fuelLevelLiters === undefined) return null;

  const units = displayUnits === 1 ? 'L' : 'gal';

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center tabular-nums">
        <GasPumpIcon />
        <span>{formatFuel(fuelLevelLiters, units, 1)}</span>
      </div>
    </div>
  );
});
FuelLevelItem.displayName = 'FuelLevelItem';
