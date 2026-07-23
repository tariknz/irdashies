import type { ShiftPointSettings } from '@irdashies/types';

export const INACTIVE_LED_COLOR = '#1f2937';
export const BLINK_LED_COLOR = '#9333ea';
export const BLINK_FLASH_COLOR = '#ffffff';
export const SHIFT_LED_COLOR = '#a855f7';

export const clampRpm = (rpm: number, maxRpm: number): number =>
  Math.max(0, Math.min(Number.isFinite(rpm) ? rpm : 0, Math.max(0, maxRpm)));

export const resolveThresholds = (
  maxRpm: number,
  shiftRpm: number,
  blinkRpm: number,
  gearRpmThresholds: readonly number[] | null
): { shift: number; blink: number } => {
  const carThreshold = gearRpmThresholds?.[0];
  if (typeof carThreshold === 'number' && carThreshold > 0) {
    return { shift: carThreshold, blink: carThreshold };
  }

  return {
    shift: shiftRpm > 0 ? shiftRpm : maxRpm * 0.9,
    blink: blinkRpm > 0 ? blinkRpm : maxRpm * 0.97,
  };
};

export const resolveLedCount = (
  carLedCount: number | null | undefined,
  ledColors: readonly string[] | null,
  fallback = 10
): number => {
  if (Number.isInteger(carLedCount) && Number(carLedCount) > 0) {
    return Math.min(64, Number(carLedCount));
  }
  if (ledColors && ledColors.length > 1) {
    return Math.min(64, ledColors.length - 1);
  }
  return Math.max(1, Math.min(64, Math.floor(fallback) || 10));
};

export const activationThreshold = (
  ledIndex: number,
  ledCount: number,
  shiftRpm: number,
  gearRpmThresholds: readonly number[] | null
): number => {
  const carThreshold = gearRpmThresholds?.[ledIndex + 1];
  if (typeof carThreshold === 'number' && carThreshold > 0) {
    return carThreshold;
  }

  if (ledCount <= 3) {
    const progress = ledCount === 1 ? 1 : ledIndex / (ledCount - 1);
    return shiftRpm * (0.75 + progress * 0.15);
  }

  if (ledIndex === ledCount - 1) return shiftRpm * 0.9;
  if (ledIndex === ledCount - 2) return shiftRpm * 0.85;
  if (ledIndex === ledCount - 3) return shiftRpm * 0.8;
  return shiftRpm * 0.75 * (ledIndex / (ledCount - 3));
};

export const isLedActive = (
  ledIndex: number,
  ledCount: number,
  rpm: number,
  shiftRpm: number,
  gearRpmThresholds: readonly number[] | null
): boolean => {
  if (rpm <= 0) return false;
  if (rpm >= shiftRpm) return true;
  return (
    rpm >= activationThreshold(ledIndex, ledCount, shiftRpm, gearRpmThresholds)
  );
};

export const normalizeLedColor = (color: string): string =>
  /^#ff[0-9a-f]{6}$/i.test(color) ? `#${color.slice(3)}` : color;

export const resolveLedColor = ({
  index,
  ledCount,
  active,
  rpm,
  shiftRpm,
  blinkRpm,
  flash,
  ledColors,
}: {
  index: number;
  ledCount: number;
  active: boolean;
  rpm: number;
  shiftRpm: number;
  blinkRpm: number;
  flash: boolean;
  ledColors: readonly string[] | null;
}): string => {
  if (!active) return INACTIVE_LED_COLOR;
  if (rpm >= blinkRpm) return flash ? BLINK_FLASH_COLOR : BLINK_LED_COLOR;
  if (rpm >= shiftRpm) return SHIFT_LED_COLOR;
  if (ledColors?.[index + 1]) return normalizeLedColor(ledColors[index + 1]);
  if (index === ledCount - 1) return '#ef4444';
  if (index >= ledCount - 3) return '#eab308';
  return '#22c55e';
};

export const resolveCustomShiftPoint = (
  settings: ShiftPointSettings | undefined,
  carPath: string | undefined,
  carId: string | undefined,
  gear: number
): number | undefined => {
  if (!settings?.enabled || gear <= 0) return undefined;
  const carConfig =
    (carPath ? settings.carConfigs[carPath] : undefined) ??
    (carId ? settings.carConfigs[carId] : undefined);
  if (!carConfig?.enabled) return undefined;
  const shiftRpm = carConfig.gearShiftPoints[gear.toString()]?.shiftRpm;
  return typeof shiftRpm === 'number' && shiftRpm > 0 ? shiftRpm : undefined;
};
