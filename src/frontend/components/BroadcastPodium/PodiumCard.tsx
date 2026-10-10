import { TrophyIcon } from '@phosphor-icons/react';
import type { Standings } from '@irdashies/domain';
import type { BroadcastPodiumStyle } from '@irdashies/types';
import { CarManufacturer } from '../shared/CarManufacturer/CarManufacturer';
import { ClassTitle, type Groups } from '../Broadcast/components/PhaseScreens';
import { driverName } from '../Broadcast/format';

/** Gold, silver and bronze, indexed by class position - 1. */
const MEDALS = [
  {
    id: 'gold',
    stops: ['#fff3b0', '#e6b422', '#8a6d1d'],
    step: 'h-16 from-yellow-100 via-amber-400 to-yellow-800',
    cup: 42,
  },
  {
    id: 'silver',
    stops: ['#ffffff', '#b8bec6', '#5f6670'],
    step: 'h-11 from-white via-slate-400 to-slate-600',
    cup: 34,
  },
  {
    id: 'bronze',
    stops: ['#ffd2a6', '#c46f2d', '#6b3410'],
    step: 'h-8 from-orange-200 via-orange-600 to-amber-900',
    cup: 30,
  },
];

const gradientId = (medal: string) => `broadcast-podium-${medal}`;

/** Bright-to-dark metal shine, used to fill the trophy icons. */
const MedalGradients = () => (
  <svg className="absolute size-0" aria-hidden>
    <defs>
      {MEDALS.map(({ id, stops }) => (
        <linearGradient
          key={id}
          id={gradientId(id)}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      ))}
    </defs>
  </svg>
);

const Place = ({
  standing,
  look,
}: {
  standing: Standings;
  look: BroadcastPodiumStyle;
}) => {
  const medal = MEDALS[(standing.classPosition ?? 3) - 1] ?? MEDALS[2];
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      {standing.carId !== undefined && (
        <span className="text-2xl">
          <CarManufacturer carId={standing.carId} />
        </span>
      )}
      <span className="w-full truncate text-center text-xs font-bold italic uppercase">
        {driverName(standing, 'surname')}
      </span>
      {/* No gap: after the flag the live gap is just cars on the cool-down
          lap, not the result. */}
      <span className="text-xs text-white/60">#{standing.driver.carNum}</span>
      {look === 'trophy' ? (
        <span className="relative flex flex-col items-center pt-1">
          <TrophyIcon
            size={medal.cup}
            weight="fill"
            color={`url(#${gradientId(medal.id)})`}
            className="drop-shadow"
          />
          <span className="text-lg font-bold italic">
            {standing.classPosition}
          </span>
        </span>
      ) : (
        <div
          className={`flex w-full items-start justify-center bg-linear-to-b pt-1 text-xl font-bold italic text-slate-900 shadow-inner ${medal.step}`}
        >
          {standing.classPosition}
        </div>
      )}
    </div>
  );
};

/** Top three of each class, second-winner-third, on steps or as trophies. */
export const PodiumCard = ({
  groups,
  look = 'steps',
}: {
  groups: Groups;
  look?: BroadcastPodiumStyle;
}) => (
  <div className="overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) pb-2 text-white">
    <MedalGradients />
    <div className="bg-linear-to-r from-amber-500 to-slate-900 px-2 py-0.5 font-bold italic text-slate-900 uppercase">
      Podium
    </div>
    {groups.map(([classId, drivers]) => {
      const [first, second, third] = drivers;
      if (!first) return null;
      return (
        <div key={classId}>
          <ClassTitle standing={first} />
          <div className="flex items-end gap-1 px-2 pt-1">
            {[second, first, third].map((s, i) =>
              s ? (
                <Place key={s.carIdx} standing={s} look={look} />
              ) : (
                <div key={i} className="flex-1" />
              )
            )}
          </div>
        </div>
      );
    })}
  </div>
);
