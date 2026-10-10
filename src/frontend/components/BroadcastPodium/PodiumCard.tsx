import { formatGap } from '@irdashies/utils/time';
import { CarManufacturer } from '../shared/CarManufacturer/CarManufacturer';
import { ClassTitle, type Groups } from '../Broadcast/components/PhaseScreens';
import { classColor, driverName } from '../Broadcast/format';

const STEP_HEIGHT = ['h-16', 'h-11', 'h-8'];

/** Top three of each class on steps: second, winner, third. */
export const PodiumCard = ({ groups }: { groups: Groups }) => (
  <div className="overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) pb-2 text-white">
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
