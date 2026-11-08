export interface WeatherSample {
  /** Sim time of day in seconds, 0..86400. */
  timeOfDay: number;
  airTemp: number;
  /** 0..1 */
  precipitation: number;
}

export interface ForecastHour {
  /** Sim time of day at the top of the hour, 0..23. */
  hour: number;
  airTemp: number;
  /** 0..100 */
  precipitationPct: number;
}

const DAY = 86400;
const HOUR = 3600;
// Below this much sim time a slope is noise, so the forecast stays flat.
const MIN_SPAN = 600;
// A short window keeps the estimate close to what is happening now.
export const MAX_SPAN = 2 * HOUR;
const MAX_TEMP_SWING_PER_HOUR = 6;

/** Seconds from `from` to `to` going forwards over midnight. */
const forward = (from: number, to: number) => (((to - from) % DAY) + DAY) % DAY;

/** Drops samples older than MAX_SPAN so the slope follows recent weather. */
export const appendSample = (
  history: readonly WeatherSample[],
  sample: WeatherSample
): WeatherSample[] => {
  const last = history[history.length - 1];
  // A clock that jumped back is a new session or a replay seek.
  const restarted = last && forward(last.timeOfDay, sample.timeOfDay) > DAY / 2;
  const kept = restarted ? [] : history;
  return [...kept, sample].filter(
    (s) => forward(s.timeOfDay, sample.timeOfDay) <= MAX_SPAN
  );
};

/**
 * Straight-line estimate of the next hours from the oldest to the newest
 * sample. This is a trend, not iRacing's own forecast, which the SDK does
 * not expose.
 */
export const forecastFromTrend = (
  history: readonly WeatherSample[],
  hours = 3
): ForecastHour[] => {
  const now = history[history.length - 1];
  if (!now) return [];
  const first = history[0];
  const span = forward(first.timeOfDay, now.timeOfDay);
  const perHour = (a: number, b: number) =>
    span >= MIN_SPAN ? ((b - a) / span) * HOUR : 0;
  const tempSlope = Math.max(
    -MAX_TEMP_SWING_PER_HOUR,
    Math.min(MAX_TEMP_SWING_PER_HOUR, perHour(first.airTemp, now.airTemp))
  );
  const rainSlope = perHour(first.precipitation, now.precipitation);
  const nextHour = Math.floor(now.timeOfDay / HOUR) + 1;

  return Array.from({ length: hours }, (_, i) => {
    // Hours ahead of now, so the first tile is the partial hour to :00.
    const ahead = (nextHour + i) * HOUR - now.timeOfDay;
    const h = ahead / HOUR;
    const rain = Math.max(0, Math.min(1, now.precipitation + rainSlope * h));
    return {
      hour: (nextHour + i) % 24,
      airTemp: now.airTemp + tempSlope * h,
      precipitationPct: Math.round(rain * 100),
    };
  });
};
