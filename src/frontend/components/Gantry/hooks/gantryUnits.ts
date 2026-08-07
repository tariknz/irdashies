import type { GantryConfig } from '@irdashies/types';

export type GantryUnitSetting = GantryConfig['units'];
export type GantrySpeedUnit = 'km/h' | 'mph';

export const KPH_PER_MPH = 1.609344;

export interface GantryUnits {
  isMetric: boolean;
  speedUnit: GantrySpeedUnit;
  /** Multiply a stored km/h value by this to get a value in `speedUnit`. */
  speedFactorFromKph: number;
}

export const kphToMph = (kph: number): number => kph / KPH_PER_MPH;

export const mphToKph = (mph: number): number => mph * KPH_PER_MPH;

/**
 * Resolves the units the Gantry should display in.
 * `displayUnits` is the iRacing `DisplayUnits` telemetry value (0 = imperial,
 * 1 = metric); when it is unknown, metric is assumed.
 */
export const resolveGantryUnits = (
  unitSetting: GantryUnitSetting | undefined,
  displayUnits: number | undefined
): GantryUnits => {
  const setting = unitSetting ?? 'auto';
  const isMetric =
    setting === 'auto'
      ? displayUnits === undefined || displayUnits === 1
      : setting === 'Metric';

  return {
    isMetric,
    speedUnit: isMetric ? 'km/h' : 'mph',
    speedFactorFromKph: isMetric ? 1 : 1 / KPH_PER_MPH,
  };
};

/** Stored km/h value -> whole number shown in the settings input. */
export const speedToDisplay = (kph: number, isMetric: boolean): number =>
  isMetric ? kph : Math.round(kphToMph(kph));

/** Value typed into the settings input -> km/h value we persist. */
export const speedFromDisplay = (value: number, isMetric: boolean): number =>
  isMetric ? value : Math.round(mphToKph(value));

/** Converts a km/h lower bound, staying inside the original range. */
export const speedMinToDisplay = (kph: number, isMetric: boolean): number =>
  isMetric ? kph : Math.ceil(kphToMph(kph));

/** Converts a km/h upper bound, staying inside the original range. */
export const speedMaxToDisplay = (kph: number, isMetric: boolean): number =>
  isMetric ? kph : Math.floor(kphToMph(kph));
