import { FuelCalculatorDisplay } from './FuelCalculatorDisplay';
import { useFuelCalculatorSettings } from './useFuelCalculatorSettings';
import { demoFuelData } from './demoData';
import type { FuelCalculatorSettings } from './types';

/** Seed strategy data immediately instead of waiting for several demo laps. */
export const FuelPreview = (config: Partial<FuelCalculatorSettings>) => {
  const settings = useFuelCalculatorSettings(config);
  return <FuelCalculatorDisplay {...settings} fuelData={demoFuelData} />;
};
