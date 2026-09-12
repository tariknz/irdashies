/**
 * Speed unit conversion.
 *
 * iRacing reports speed in m/s and signals the driver's preference through the
 * DisplayUnits telemetry key (0 = imperial, 1 = metric). The same two literals
 * are currently open-coded in several widgets; this is the shared version, and
 * new code should use it rather than repeating the constants.
 */

const MS_TO_KMH = 3.6;
const MS_TO_MPH = 2.23694;

/** iRacing DisplayUnits: 1 means metric. */
export const DISPLAY_UNITS_METRIC = 1;

export type SpeedUnitSetting = 'mph' | 'km/h' | 'auto';

/**
 * Whether to render metric, resolving 'auto' against the sim's own setting.
 * An undefined displayUnits (telemetry not yet available) falls back to metric,
 * matching the existing InputGear behaviour.
 */
export function isMetricSpeed(
  setting: SpeedUnitSetting,
  displayUnits: number | undefined
): boolean {
  if (setting === 'km/h') return true;
  if (setting === 'mph') return false;
  return displayUnits === undefined || displayUnits === DISPLAY_UNITS_METRIC;
}

/** Convert m/s to the display unit. Returns 0 for undefined input. */
export function msToDisplaySpeed(
  speedMs: number | undefined,
  setting: SpeedUnitSetting,
  displayUnits: number | undefined
): number {
  const metric = isMetricSpeed(setting, displayUnits);
  return (speedMs ?? 0) * (metric ? MS_TO_KMH : MS_TO_MPH);
}

/** Label for the resolved display unit. */
export function speedUnitLabel(
  setting: SpeedUnitSetting,
  displayUnits: number | undefined
): 'km/h' | 'mph' {
  return isMetricSpeed(setting, displayUnits) ? 'km/h' : 'mph';
}
