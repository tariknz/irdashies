import { useEffect, useState } from 'react';
import { useDashboard } from '@irdashies/context';
import type {
  BroadcastConfig,
  BroadcastEventsConfig,
  BroadcastPodiumConfig,
  BroadcastTickerConfig,
  BroadcastWeatherConfig,
} from '@irdashies/types';
import { TowerView } from '../../Broadcast/Broadcast';
import { TickerView } from '../../BroadcastTicker/BroadcastTicker';
import { EventCard } from '../../BroadcastEvents/BroadcastEvents';
import { demoEvent } from '../../BroadcastEvents/broadcastEvents';
import { WeatherView } from '../../BroadcastWeather/WeatherCard';
import { PodiumCard } from '../../BroadcastPodium/PodiumCard';
import { DEMO_GROUPS as GROUPS } from '../../Broadcast/demoField';

const STANDINGS = GROUPS.flatMap(([, drivers]) => drivers);
const CAR_IDXS = STANDINGS.map((s) => s.carIdx);
/** The car the preview camera is on. */
const FOCUS_CAR = 6;
const CHANGES = new Map([
  [1, { delta: 1, seq: 1 }],
  [2, { delta: -1, seq: 1 }],
]);

/** Counts up every `seconds`, so cards come and go like on stream. */
const useCycle = (seconds: number) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((i) => i + 1), seconds * 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return n;
};

const EventsPreview = ({ config }: { config?: BroadcastEventsConfig }) => {
  const n = useCycle(config?.showSeconds ?? 8);
  const event = demoEvent(n, CAR_IDXS, config?.kinds);
  if (!event) return <Empty>Every event kind is off.</Empty>;
  return (
    <EventCard
      event={event}
      standing={STANDINGS.find((s) => s.carIdx === event.carIdx)}
      opacity={config?.background?.opacity}
    />
  );
};

const WeatherPreview = ({ config }: { config?: BroadcastWeatherConfig }) => {
  const n = useCycle(Math.min(config?.showSeconds ?? 12, 6));
  const wet = n % 2 === 1;
  return (
    <div
      style={{
        ['--bg-opacity' as string]: `${config?.background?.opacity ?? 85}%`,
      }}
    >
      <WeatherView
        popup={{ id: n, headline: wet ? 'Rain started' : 'Conditions' }}
        sample={{
          wetness: wet ? 4 : 1,
          precipitation: wet ? 0.35 : 0,
          trackTemp: wet ? 24 : 31,
          airTemp: wet ? 19 : 24,
          windSpeed: 3.5,
        }}
        metric
      />
    </div>
  );
};

const Empty = ({ children }: { children: string }) => (
  <p className="text-sm text-slate-500">{children}</p>
);

/**
 * The open module drawn with the settings being edited, on made-up cars, so
 * changes show without a session running.
 */
export const BroadcastPreview = ({ module }: { module: string }) => {
  const { currentDashboard } = useDashboard();
  const config = <T,>(id: string) =>
    currentDashboard?.widgets.find((w) => w.id === id)?.config as T | undefined;

  const preview = () => {
    switch (module) {
      case 'broadcastticker':
        return (
          <TickerView
            settings={config<BroadcastTickerConfig>(module)}
            groups={GROUPS}
            teamRacing={false}
          />
        );
      case 'broadcastevents':
        return <EventsPreview config={config<BroadcastEventsConfig>(module)} />;
      case 'broadcastweather':
        return (
          <WeatherPreview config={config<BroadcastWeatherConfig>(module)} />
        );
      case 'broadcastpodium': {
        const podium = config<BroadcastPodiumConfig>(module);
        return (
          <div
            className="text-sm"
            style={{
              ['--bg-opacity' as string]: `${podium?.background?.opacity ?? 90}%`,
            }}
          >
            <PodiumCard groups={GROUPS} look={podium?.style} />
          </div>
        );
      }
      default: {
        const tower = config<BroadcastConfig>('broadcast');
        return (
          <TowerView
            settings={tower}
            groups={GROUPS}
            title={tower?.title || 'Preview Raceway'}
            focusCarIdx={FOCUS_CAR}
            changes={CHANGES}
            hasTyreChoice
            showGrid={false}
          />
        );
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        Preview
      </div>
      {/* Remounts per module so each starts its animations fresh. */}
      <div key={module}>{preview()}</div>
    </div>
  );
};
