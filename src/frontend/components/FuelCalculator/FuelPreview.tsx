import { FuelCalculator } from './FuelCalculator';
import { previewFuelData } from './previewData';
import type { FuelCalculatorSettings } from './types';

/** Seed strategy data immediately instead of waiting for several demo laps. */
export const FuelPreview = (config: Partial<FuelCalculatorSettings>) => (
  <FuelCalculator {...config} previewData={previewFuelData} embedded />
);
