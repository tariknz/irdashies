import { useEffect, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import {
  CloudRainIcon,
  DropIcon,
  SunIcon,
  WindIcon,
} from '@phosphor-icons/react';
import { useSessionBarSelector, useSessionStore } from '@irdashies/context';
import type { SessionBarSnapshot } from '@irdashies/types';
import { useStore } from 'zustand';
import { describeWeatherChange, type WeatherSample } from './weatherChange';

const WETNESS_LABELS = [
  '-',
  'Dry',
  'Mostly Dry',
  'Very Lightly Wet',
  'Lightly Wet',
  'Moderately Wet',
  'Very Wet',
  'Extremely Wet',
];

const selectWeather = (s: SessionBarSnapshot) =>
  [
    s.trackWetness,
    s.precipitation,
    s.trackTemp,
    s.airTemp,
    s.windVelocity,
    s.displayUnits,
  ] as const;

const round = (n?: number) => (n === undefined ? undefined : Math.round(n));

const useWeatherSample = () => {
  const data = useSessionBarSelector(selectWeather, { equality: shallow });
  const [wetness, precipitation, trackTempRaw, airTempRaw, wind, units] =
    data ?? [];
  const hasData = data !== undefined;
  // Rounded temps keep tiny telemetry drift from rebuilding the sample.
  const trackTemp = round(trackTempRaw);
  const airTemp = round(airTempRaw);
  const sample = useMemo<WeatherSample | undefined>(
    () =>
      hasData
        ? {
            wetness: wetness ?? 0,
            precipitation: precipitation ?? 0,
            trackTemp,
            airTemp,
            windSpeed: wind,
          }
        : undefined,
    [hasData, wetness, precipitation, trackTemp, airTemp, wind]
  );
  return { sample, metric: units !== 0 };
};

const useTrackRubber = () =>
  useStore(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.findLast(
        (session) => session.SessionTrackRubberState !== 'carry over'
      )?.SessionTrackRubberState
  );

interface Popup {
  headline: string;
  id: number;
}

/**
 * Pops the card up on start, whenever conditions change enough to matter,
 * and every `intervalMinutes` (0 = only on change). It hides itself after
 * `showSeconds`.
 */
const useWeatherPopup = (
  sample: WeatherSample | undefined,
  intervalMinutes: number,
  showSeconds: number
) => {
  const [popup, setPopup] = useState<Popup | null>(null);
  // Conditions as viewers last saw them; slow drifts add up against this.
  const seen = useRef<WeatherSample | undefined>(undefined);
  const latest = useRef(sample);

  useEffect(() => {
    latest.current = sample;
    if (!sample) return;
    const headline = seen.current
      ? describeWeatherChange(seen.current, sample)
      : 'Conditions';
    if (!headline) return;
    seen.current = sample;
    setPopup((p) => ({ headline, id: (p?.id ?? 0) + 1 }));
  }, [sample]);

  useEffect(() => {
    if (!intervalMinutes) return;
    const id = setInterval(() => {
      if (!latest.current) return;
      seen.current = latest.current;
      setPopup((p) => ({ headline: 'Weather update', id: (p?.id ?? 0) + 1 }));
    }, intervalMinutes * 60_000);
    return () => clearInterval(id);
  }, [intervalMinutes]);

  useEffect(() => {
    if (!popup) return;
    const id = setTimeout(() => setPopup(null), showSeconds * 1000);
    return () => clearTimeout(id);
  }, [popup, showSeconds]);

  return popup;
};

const temp = (c: number | undefined, metric: boolean) =>
  c === undefined
    ? '-'
    : metric
      ? `${c}°C`
      : `${Math.round((c * 9) / 5 + 32)}°F`;

const wind = (ms: number | undefined, metric: boolean) =>
  ms === undefined
    ? '-'
    : metric
      ? `${Math.round(ms * 3.6)} km/h`
      : `${Math.round(ms * 2.237)} mph`;

/** Sun turns, rain falls, a wet track pulses. */
const WeatherIcon = ({ sample }: { sample: WeatherSample }) => {
  if (sample.precipitation > 0.01) {
    return (
      <span className="relative inline-block h-12 w-12">
        <CloudRainIcon size={48} weight="fill" className="text-sky-300" />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute top-8 h-2 w-0.5 rounded-full bg-sky-300"
            style={{
              left: 10 + i * 9,
              animation: `broadcast-rain 0.8s linear ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </span>
    );
  }
  if (sample.wetness >= 3) {
    return (
      <DropIcon
        size={48}
        weight="fill"
        className="animate-pulse text-sky-400"
      />
    );
  }
  return (
    <SunIcon
      size={48}
      weight="fill"
      className="animate-[spin_12s_linear_infinite] text-amber-300"
    />
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs text-white/50">{label}</div>
    <div className="font-bold">{value}</div>
  </div>
);

export const WeatherCard = ({
  intervalMinutes,
  showSeconds,
}: {
  intervalMinutes: number;
  showSeconds: number;
}) => {
  const { sample, metric } = useWeatherSample();
  const rubber = useTrackRubber();
  const popup = useWeatherPopup(sample, intervalMinutes, showSeconds);
  if (!popup || !sample) return null;

  return (
    <div
      key={popup.id}
      className="animate-broadcast-enter overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) text-white"
    >
      <div className="flex justify-between bg-linear-to-r from-sky-700 to-slate-900 px-2 py-0.5 font-bold italic uppercase">
        <span>Weather</span>
        <span className="text-cyan-300">{popup.headline}</span>
      </div>
      <div className="flex items-center gap-3 px-2 py-2 uppercase">
        <WeatherIcon sample={sample} />
        <div className="grid flex-1 grid-cols-3 gap-x-3 gap-y-1 text-sm tabular-nums">
          <Stat label="Air" value={temp(sample.airTemp, metric)} />
          <Stat label="Track" value={temp(sample.trackTemp, metric)} />
          <Stat
            label="Rain"
            value={`${Math.round(sample.precipitation * 100)}%`}
          />
          <div className="col-span-2">
            <Stat
              label="Surface"
              value={WETNESS_LABELS[sample.wetness] ?? '-'}
            />
          </div>
          <div className="flex items-end gap-1">
            <WindIcon size={14} className="mb-0.5 text-white/50" />
            <span className="font-bold">{wind(sample.windSpeed, metric)}</span>
          </div>
          {rubber && (
            <div className="col-span-3">
              <Stat label="Rubber" value={rubber} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
