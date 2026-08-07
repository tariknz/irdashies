import { useMemo } from 'react';
import { useTelemetryValue } from '@irdashies/context';
import { useGantrySettings } from './useGantrySettings';
import { resolveGantryUnits, type GantryUnits } from './gantryUnits';

export const useGantryUnits = (): GantryUnits => {
  const settings = useGantrySettings();
  const displayUnits = useTelemetryValue('DisplayUnits'); // 0 = imperial, 1 = metric
  const unitSetting = settings.units;

  return useMemo(
    () => resolveGantryUnits(unitSetting, displayUnits),
    [unitSetting, displayUnits]
  );
};
