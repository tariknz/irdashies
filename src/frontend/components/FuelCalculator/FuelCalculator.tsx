import { useDashboard } from '@irdashies/context';
import type { FuelCalculation, FuelCalculatorSettings } from './types';
import { useFuelCalculation } from './useFuelCalculation';
import { useFuelCalculatorSettings } from './useFuelCalculatorSettings';
import { FuelCalculatorDisplay } from './FuelCalculatorDisplay';
import { demoFuelData } from './demoData';

type FuelCalculatorProps = Partial<FuelCalculatorSettings> & {
  /** Storybook overrides; demo hosts always use this widget's shared data. */
  previewData?: FuelCalculation;
  /** Embedded live copies never write lap history twice. */
  embedded?: boolean;
};

const LiveFuelCalculator = ({
  previewData,
  embedded,
  ...settings
}: FuelCalculatorSettings &
  Pick<FuelCalculatorProps, 'previewData' | 'embedded'>) => {
  const fuelData = useFuelCalculation(
    settings.safetyMargin,
    settings,
    embedded
  );
  return (
    <FuelCalculatorDisplay {...settings} fuelData={previewData ?? fuelData} />
  );
};

export const FuelCalculator = (props: FuelCalculatorProps) => {
  const { isDemoMode } = useDashboard();
  const settings = useFuelCalculatorSettings(props);
  return isDemoMode ? (
    <FuelCalculatorDisplay {...settings} fuelData={demoFuelData} />
  ) : (
    <LiveFuelCalculator {...settings} />
  );
};
