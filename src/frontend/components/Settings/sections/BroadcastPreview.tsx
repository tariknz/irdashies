import { useEffect, useState } from 'react';
import { useDashboard } from '@irdashies/context';
import type { Standings } from '@irdashies/domain';
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

const GTP = { id: 1, color: 0xffda59, name: 'GTP' };
const GTD = { id: 2, color: 0x33ceff, name: 'GTD' };

/** Made-up field, so the preview works with no sim running. */
const car = (
  carIdx: number,
  classPosition: number,
  name: string,
  carId: number,
  carClass: typeof GTP,
  extra: Partial<Standings> = {}
) =>
  ({
    carIdx,
    position: carIdx + 1,
    classPosition,
    carId,
    driver: { name, carNum: String(10 + carIdx), teamName: '' },
    carClass,
    gap:
      classPosition === 1
        ? { value: undefined, laps: 0 }
        : { value: (classPosition - 1) * 1.8, laps: 0 },
    interval: classPosition === 1 ? undefined : 0.6 + classPosition * 0.3,
    fastestTime: 95 + carIdx * 0.37,
    lap: 24,
    positionChange: (carIdx % 3) - 1,
    lastPitLap: 18 + (carIdx % 3),
    tireCompound: carIdx % 2,
    onPitRoad: false,
    repair: false,
    penalty: false,
    slowdown: false,
    dnf: false,
    radioActive: false,
    ...extra,
  }) as unknown as Standings;

const GROUPS: [string, Standings[]][] = [
  [
    '1',
    [
      car(0, 1, 'Sebastien Bourdais', 168, GTP),
      car(1, 2, 'Felipe Nasr', 174, GTP, { radioActive: true }),
      car(2, 3, 'Nick Tandy', 174, GTP),
      car(3, 4, 'Ricky Taylor', 170, GTP, { onPitRoad: true }),
    ],
  ],
  [
    '2',
    [
      car(4, 1, 'Jack Hawksworth', 133, GTD),
      car(5, 2, 'Russell Ward', 156, GTD),
      car(6, 3, 'Frankie Montecalvo', 169, GTD),
      car(7, 4, 'Robby Foley', 132, GTD),
    ],
  ],
];
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
