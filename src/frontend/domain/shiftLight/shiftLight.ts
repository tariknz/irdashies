import type { ShiftPointSettings } from '@irdashies/types';

export type ShiftFlashSource = 'redline' | 'shiftPoints';

/**
 * RPM where the Tachometer LEDs start blinking. Same fallback order as the
 * Tachometer: per-gear redline from car data, then iRacing's blink RPM,
 * then 97% of the car redline.
 */
export const getRedlineFlashRpm = (
  maxRpm: number,
  blinkRpm: number,
  gearRedlineRpm: number | null | undefined
): number => gearRedlineRpm ?? (blinkRpm || maxRpm * 0.97);

/**
 * Custom shift RPM set in the Tachometer settings for this car and gear.
 * Returns undefined when custom shift points are off, the car is not set up
 * or disabled, or the gear has no shift point.
 */
export const getCustomShiftRpm = (
  settings: ShiftPointSettings | undefined,
  carId: string | undefined,
  gear: number
): number | undefined => {
  if (!settings?.enabled || !carId || gear <= 0) return undefined;
  const car = settings.carConfigs?.[carId];
  if (!car?.enabled) return undefined;
  const rpm = car.gearShiftPoints?.[String(gear)]?.shiftRpm;
  return typeof rpm === 'number' && rpm > 0 ? rpm : undefined;
};

/**
 * RPM that triggers the flash. 'shiftPoints' uses the custom shift point and
 * falls back to the redline where none is set.
 */
export const getShiftFlashRpm = (
  source: ShiftFlashSource,
  customShiftRpm: number | undefined,
  redlineFlashRpm: number
): number =>
  source === 'shiftPoints' && customShiftRpm !== undefined
    ? customShiftRpm
    : redlineFlashRpm;

export const isShiftFlashActive = (rpm: number, thresholdRpm: number) =>
  rpm > 0 && thresholdRpm > 0 && rpm >= thresholdRpm;
