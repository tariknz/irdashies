/**
 * A numeric setting read from saved config, which is user-editable JSON:
 * kept inside the range its slider offers, or the fallback when it is not a
 * finite number. Timers built from it then never run at 0 ms.
 */
export const clampSetting = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;
