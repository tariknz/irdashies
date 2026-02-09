import { FuelWidgetSettings, SessionVisibilitySettings, BoxConfig, LayoutNode } from '../../types';
import { defaultFuelCalculatorSettings } from '../../../FuelCalculator/defaults';

const defaultConfig = defaultFuelCalculatorSettings;

export const migrateConfig = (savedConfig: unknown): FuelWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    ...defaultConfig,
    ...config,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
    layoutConfig: (config.layoutConfig as BoxConfig[]) ?? [],
    layoutTree: (config.layoutTree && (config.layoutTree as LayoutNode).type ? (config.layoutTree as LayoutNode) : undefined),
    consumptionGridOrder: (config.consumptionGridOrder as string[]) ?? defaultConfig.consumptionGridOrder,
    enableTargetPitLap: (config.enableTargetPitLap as boolean) ?? defaultConfig.enableTargetPitLap,
    targetPitLap: (config.targetPitLap as number) ?? defaultConfig.targetPitLap,
    targetPitLapBasis: (config.targetPitLapBasis as FuelWidgetSettings['config']['targetPitLapBasis']) ?? defaultConfig.targetPitLapBasis,

    fuelStatusThresholds: (config.fuelStatusThresholds as FuelWidgetSettings['config']['fuelStatusThresholds']) ?? defaultConfig.fuelStatusThresholds,
    fuelStatusBasis: (config.fuelStatusBasis as FuelWidgetSettings['config']['fuelStatusBasis']) ?? defaultConfig.fuelStatusBasis,
    fuelStatusRedLaps: (config.fuelStatusRedLaps as number) ?? defaultConfig.fuelStatusRedLaps,
    avgLapsCount: (config.avgLapsCount as number) ?? defaultConfig.avgLapsCount,
    enableStorage: (config.enableStorage as boolean) ?? defaultConfig.enableStorage,
    enableLogging: (config.enableLogging as boolean) ?? defaultConfig.enableLogging,
  };
};

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const AVAILABLE_WIDGETS_FUEL: { id: string; label: string }[] = [
  { id: 'fuelHeader', label: 'Header (Stops/Window/Confidence)' },
  { id: 'fuelConfidence', label: 'Confidence Messages' },
  { id: 'fuelGauge', label: 'Fuel Gauge' },
  { id: 'fuelGrid', label: 'Consumption Grid' },
  { id: 'fuelScenarios', label: 'Pit Scenarios' },
  { id: 'fuelTargetMessage', label: 'Target Pit Message' },
  { id: 'fuelGraph', label: 'Fuel History' },
  { id: 'fuelTimeEmpty', label: 'Time Until Empty' },
  { id: 'fuelEconomyPredict', label: 'Economy Predict (Laps vs Target)' },
];
