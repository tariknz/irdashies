import { memo, useMemo, useState } from 'react';
import { useDriverStandings } from '../../../Standings/hooks/useDriverStandings';
import { useLapGapStore } from '@irdashies/context';
import { LapGapChart } from './LapGapChart';
import type { ChartDriver } from './LapGapChart';

interface Props {
  standingsByClass: ReturnType<typeof useDriverStandings>;
}

export const LapGraphView = memo(({ standingsByClass }: Props) => {
  const lapGaps = useLapGapStore((s) => s.lapGaps);

  const classes = useMemo(
    () =>
      standingsByClass.map(([classId, drivers]) => {
        const first = drivers[0];
        return {
          classId,
          name: first?.carClass.name ?? classId,
          color: first?.carClass.color ?? 0x94a3b8,
          drivers,
        };
      }),
    [standingsByClass]
  );

  const defaultClassId = useMemo(() => {
    for (const cls of classes) {
      if (cls.drivers.some((d) => d.isPlayer)) return cls.classId;
    }
    return classes[0]?.classId ?? null;
  }, [classes]);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const activeClassId = selectedClassId ?? defaultClassId;

  const activeClass = classes.find((c) => c.classId === activeClassId);
  const activeColorHex = activeClass
    ? `#${activeClass.color.toString(16).padStart(6, '0')}`
    : undefined;

  const chartDrivers = useMemo<ChartDriver[]>(() => {
    if (!activeClass) return [];
    return activeClass.drivers
      .filter(
        (d) => lapGaps[d.carIdx] && Object.keys(lapGaps[d.carIdx]).length > 0
      )
      .map((d) => ({
        carIdx: d.carIdx,
        name: d.driver.name,
        carNumber: d.driver.carNum,
        classColor: activeClass.color,
        gaps: lapGaps[d.carIdx],
      }));
  }, [activeClass, lapGaps]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Class filter — only shown for multi-class sessions */}
      {classes.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700/50 flex-shrink-0">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Class
          </span>
          {activeColorHex && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: activeColorHex }}
            />
          )}
          <select
            className="bg-slate-800 border border-slate-600 rounded text-xs text-white px-2 py-0.5 cursor-pointer focus:outline-none focus:border-slate-400"
            value={activeClassId ?? ''}
            onChange={(e) => setSelectedClassId(e.target.value || null)}
          >
            {classes.map((cls) => (
              <option key={cls.classId} value={cls.classId}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0 p-3">
        <LapGapChart drivers={chartDrivers} />
      </div>
    </div>
  );
});
LapGraphView.displayName = 'LapGraphView';
