import type { Standings } from '@irdashies/domain';
import { formatGap } from '@irdashies/utils/time';
import { CarManufacturer } from '../../shared/CarManufacturer/CarManufacturer';
import { classColor, driverName } from '../format';

type Groups = [string, Standings[]][];

const ClassTitle = ({ standing }: { standing: Standings }) => (
  <div className="flex items-center gap-2 px-2 pt-1 font-bold italic text-white uppercase">
    <span className={`h-3 w-1 ${classColor(standing.carClass.color)}`} />
    {standing.carClass.name}
  </div>
);

const Slot = ({ standing }: { standing: Standings }) => (
  <div className="flex items-center gap-1.5 border-l-2 border-white/40 bg-slate-900/80 px-1.5 py-0.5 font-bold italic uppercase">
    <span className="w-5 text-right">{standing.classPosition}</span>
    <span
      className={`w-8 rounded-xs text-center text-slate-900 ${classColor(standing.carClass.color)}`}
    >
      {standing.driver.carNum}
    </span>
    <span className="truncate">{driverName(standing, 'surname')}</span>
  </div>
);

/**
 * Starting grid in staggered pairs, like the TV graphic: odd slots on the
 * left, even slots half a row lower on the right.
 */
export const GridCard = ({
  groups,
  perClass,
}: {
  groups: Groups;
  perClass: number;
}) => (
  <div className="animate-broadcast-enter overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) pb-2 text-white">
    <div className="bg-linear-to-r from-slate-700 to-slate-900 px-2 py-0.5 font-bold italic text-cyan-300 uppercase">
      Starting Grid
    </div>
    {groups.map(([classId, drivers]) =>
      drivers[0] ? (
        <div key={classId}>
          <ClassTitle standing={drivers[0]} />
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-2 pt-1">
            {drivers.slice(0, perClass).map((s, i) => (
              <div key={s.carIdx} className={i % 2 ? 'translate-y-3' : ''}>
                <Slot standing={s} />
              </div>
            ))}
          </div>
          <div className="h-3" />
        </div>
      ) : null
    )}
  </div>
);

const STEP_HEIGHT = ['h-16', 'h-11', 'h-8'];

/** Top three of each class on steps: second, winner, third. */
export const PodiumCard = ({ groups }: { groups: Groups }) => (
  <div className="animate-broadcast-enter overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) pb-2 text-white">
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
                <div
                  key={s.carIdx}
                  className="flex min-w-0 flex-1 flex-col items-center"
                >
                  {s.carId !== undefined && (
                    <span className="text-2xl">
                      <CarManufacturer carId={s.carId} />
                    </span>
                  )}
                  <span className="w-full truncate text-center text-xs font-bold italic uppercase">
                    {driverName(s, 'surname')}
                  </span>
                  <span className="text-xs text-white/60 tabular-nums">
                    {s.classPosition === 1 || s.gap?.value === undefined
                      ? `#${s.driver.carNum}`
                      : `+${formatGap(s.gap.value, 3)}`}
                  </span>
                  <div
                    className={`flex w-full items-start justify-center pt-1 text-xl font-bold italic text-slate-900 ${STEP_HEIGHT[(s.classPosition ?? 3) - 1] ?? 'h-8'} ${classColor(s.carClass.color)}`}
                  >
                    {s.classPosition}
                  </div>
                </div>
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
