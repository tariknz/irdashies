/**
 * Speed unit conversion and resolution.
 *
 * Speed was the one quantity without a shared home: temperature has
 * `formatTemperature`, fuel has `formatFuel`, but every widget showing a speed
 * carried its own copy of the factors — `3.6` and `2.23694` in four places,
 * `1.60934` in two more, `0.621371` in another. Same numbers, written out each
 * time, with nothing keeping them consistent.
 *
 * The `'auto'` resolution was duplicated alongside them: read iRacing's
 * `DisplayUnits`, fall back to it when the widget's own setting says `'auto'`.
 * That is here too, so a widget added later gets both halves for free rather
 * than reinventing them — and, in practice, rather than shipping metric-only
 * because reinventing it was easy to skip.
 */

export type SpeedUnit = 'km/h' | 'mph';

/**
 * iRacing's `DisplayUnits` telemetry channel: 0 = imperial, 1 = metric.
 * Named because `displayUnits === 1` on its own reads as a magic number.
 */
export const IRACING_UNITS_METRIC = 1;

/** m/s to km/h. */
const MS_TO_KPH = 3.6;
/** m/s to mph. */
const MS_TO_MPH = 2.23694;
/** km/h in one mph. */
const KPH_PER_MPH = 1.60934;

/**
 * Resolve a widget's unit setting against iRacing's own display setting.
 *
 * `'auto'`, `undefined`, and anything unrecognised follow iRacing. An explicit
 * `'km/h'` or `'mph'` wins, which is the point of having the setting at all.
 */
export const resolveSpeedUnit = (
  setting: SpeedUnit | 'auto' | undefined,
  displayUnits: number | undefined
): SpeedUnit => {
  if (setting === 'km/h' || setting === 'mph') return setting;
  return displayUnits === IRACING_UNITS_METRIC ? 'km/h' : 'mph';
};

/**
 * Convert m/s — the unit almost every iRacing speed channel reports in — to the
 * display unit.
 */
export const speedFromMs = (speedMs: number, unit: SpeedUnit): number =>
  speedMs * (unit === 'km/h' ? MS_TO_KPH : MS_TO_MPH);

/**
 * Convert a km/h value to the display unit. For the few places already holding
 * km/h rather than m/s.
 */
export const speedFromKph = (speedKph: number, unit: SpeedUnit): number =>
  unit === 'km/h' ? speedKph : speedKph / KPH_PER_MPH;

/**
 * Convert a value in the display unit back to km/h, for comparing against
 * something stored in km/h — a pit limit entered in mph, say.
 */
export const kphFromSpeed = (speed: number, unit: SpeedUnit): number =>
  unit === 'km/h' ? speed : speed * KPH_PER_MPH;

/**
 * Convert a value in the display unit back to m/s, the inverse of
 * `speedFromMs`. Used where a figure written in display units has to be fed
 * back into something expecting raw telemetry, such as fixture data.
 */
export const msFromSpeed = (speed: number, unit: SpeedUnit): number =>
  speed / (unit === 'km/h' ? MS_TO_KPH : MS_TO_MPH);
