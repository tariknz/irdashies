import type { Standings } from '@irdashies/domain';
import { classColor, driverName } from '../format';

export type Groups = [string, Standings[]][];

export const ClassTitle = ({ standing }: { standing: Standings }) => (
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
  <div className="overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) pb-2 text-white">
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
