export interface WeatherSample {
  /** iRacing TrackWetness: 1 dry .. 7 extremely wet, 0 unknown. */
  wetness: number;
  /** 0..1 */
  precipitation: number;
  /** Celsius, rounded. */
  trackTemp?: number;
  airTemp?: number;
  /** m/s */
  windSpeed?: number;
}

const RAIN = 0.01;
const TRACK_TEMP_STEP = 3;

/**
 * What changed since the conditions viewers last saw, as a headline, or
 * undefined when nothing worth a popup happened.
 */
export const describeWeatherChange = (
  seen: WeatherSample,
  now: WeatherSample
): string | undefined => {
  if (seen.precipitation <= RAIN && now.precipitation > RAIN) {
    return 'Rain started';
  }
  if (seen.precipitation > RAIN && now.precipitation <= RAIN) {
    return 'Rain stopped';
  }
  if (seen.wetness && now.wetness > seen.wetness) return 'Track getting wetter';
  if (now.wetness && now.wetness < seen.wetness) return 'Track drying';
  if (seen.trackTemp !== undefined && now.trackTemp !== undefined) {
    const delta = now.trackTemp - seen.trackTemp;
    if (delta >= TRACK_TEMP_STEP) return 'Track temp rising';
    if (delta <= -TRACK_TEMP_STEP) return 'Track temp falling';
  }
  return undefined;
};
