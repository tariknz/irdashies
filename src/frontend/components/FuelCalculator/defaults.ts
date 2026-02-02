import type { LayoutNode } from '../Settings/types';
import type { FuelCalculatorSettings } from './types';

// Default Layout Tree
export const DEFAULT_FUEL_LAYOUT_TREE: LayoutNode = {
  id: 'root-fuel-default',
  type: 'split',
  direction: 'col',
  children: [
    {
      id: 'box-1',
      type: 'box',
      direction: 'col',
      widgets: [
        'fuelHeader',
        'fuelGauge',
        'fuelGrid',
      ],
    },
  ],
};

// Default Configuration Object
export const defaultFuelCalculatorSettings: FuelCalculatorSettings = {
  showOnlyWhenOnTrack: true,
  fuelUnits: 'L',
  layout: 'vertical',
  showConsumption: true,
  showFuelLevel: true,
  showLapsRemaining: true,
  showMin: false,
  showCurrentLap: true,
  showLastLap: true,
  show3LapAvg: true,
  show10LapAvg: true,
  showMax: true,
  showPitWindow: true,
  showEnduranceStrategy: true,
  showFuelScenarios: true,
  showFuelRequired: true,
  showQualifyConsumption: false,
  showFuelHistory: true,
  fuelHistoryType: 'histogram',
  safetyMargin: 0,
  background: { opacity: 85 },
  fuelRequiredMode: 'toFinish',
  enableTargetPitLap: false,
  targetPitLap: 15,
  targetPitLapBasis: 'avg',

  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
  layoutConfig: [], // Default empty
  layoutTree: undefined, // Will be migrated on load
  consumptionGridOrder: ['curr', 'avg', 'max', 'last', 'min', 'qual'],
  avgLapsCount: 5,
  fuelStatusThresholds: { green: 35, amber: 15, red: 10 },
  fuelStatusBasis: 'avg',
  fuelStatusRedLaps: 3,
  widgetStyles: {
    fuelGraph: { height: 64, labelFontSize: 10, valueFontSize: 12, barFontSize: 8 },
    fuelHeader: { labelFontSize: 10, valueFontSize: 14 },
    fuelConfidence: { labelFontSize: 10, valueFontSize: 12 },
    fuelGauge: { labelFontSize: 10, valueFontSize: 12 },
    fuelTimeEmpty: { labelFontSize: 10, valueFontSize: 14 },
    fuelGrid: { labelFontSize: 10, valueFontSize: 12 },
    fuelScenarios: { labelFontSize: 10, valueFontSize: 12 },
    fuelTargetMessage: { labelFontSize: 10, valueFontSize: 12 },
    fuelEconomyPredict: { labelFontSize: 12, valueFontSize: 14 },
  },
  enableStorage: true,
  enableLogging: false,
};
