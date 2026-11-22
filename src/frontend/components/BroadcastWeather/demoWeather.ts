import type { WeatherSample } from './weatherChange';

const DEMO_WEATHER: WeatherSample[] = [
  {
    wetness: 1,
    precipitation: 0,
    trackTemp: 28,
    airTemp: 22,
    windSpeed: 3,
  },
  {
    wetness: 2,
    precipitation: 0.05,
    trackTemp: 26,
    airTemp: 20,
    windSpeed: 8,
  },
  {
    wetness: 4,
    precipitation: 0.35,
    trackTemp: 22,
    airTemp: 17,
    windSpeed: 14,
  },
  {
    wetness: 6,
    precipitation: 0.7,
    trackTemp: 19,
    airTemp: 15,
    windSpeed: 22,
  },
];

/** Cycles dry → wet every ~6s for the Broadcast Weather card. */
export const getDemoWeatherSample = (elapsedSec = 0): WeatherSample =>
  DEMO_WEATHER[Math.floor(elapsedSec / 6) % DEMO_WEATHER.length];
