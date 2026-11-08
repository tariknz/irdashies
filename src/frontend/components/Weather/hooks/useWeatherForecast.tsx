import { useEffect, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import type { SessionBarSnapshot } from '@irdashies/types';
import { useSessionBarSelector } from '@irdashies/context';
import {
  appendSample,
  forecastFromTrend,
  type WeatherSample,
} from './forecast';

// Sampled every 5 sim minutes, which also keeps the selector from firing on
// every tick of the clock.
const SAMPLE_STEP = 300;

const select = (snapshot: SessionBarSnapshot) =>
  [
    snapshot.sessionTimeOfDay === undefined
      ? undefined
      : Math.floor(snapshot.sessionTimeOfDay / SAMPLE_STEP),
    snapshot.airTemp,
    snapshot.precipitation === undefined
      ? undefined
      : Math.round(snapshot.precipitation * 100) / 100,
  ] as const;

export const useWeatherForecast = (enabled: boolean) => {
  const [bucket, airTemp, precipitation] =
    useSessionBarSelector(select, { equality: shallow }) ?? [];
  const history = useRef<WeatherSample[]>([]);
  const [samples, setSamples] = useState<WeatherSample[]>([]);

  useEffect(() => {
    if (!enabled || bucket === undefined || airTemp === undefined) return;
    history.current = appendSample(history.current, {
      timeOfDay: bucket * SAMPLE_STEP,
      airTemp,
      precipitation: precipitation ?? 0,
    });
    setSamples(history.current);
  }, [enabled, bucket, airTemp, precipitation]);

  return useMemo(() => forecastFromTrend(samples), [samples]);
};
