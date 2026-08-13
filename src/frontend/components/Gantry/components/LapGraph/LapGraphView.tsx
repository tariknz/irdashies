import { memo, useMemo, useState } from 'react';
import { useDriverStandings } from '../../../Standings/hooks/useDriverStandings';
import { useLapGapStore } from '@irdashies/context';
import { LapGapChart } from './LapGapChart';
import type { ChartDriver } from './LapGapChart';
import { Tooltip } from '../Tooltip/Tooltip';

export const LapGraphView = memo(() => {
  const standingsByClass = useDriverStandings(undefined, { showAll: true });
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
  // A class the user picked can disappear — a multi-class session dropping to
  // one class hides the selector entirely — which would otherwise leave the
  // chart permanently empty. Fall back to the default whenever the selection
  // is no longer on the grid.
  const activeClassId =
    selectedClassId !== null &&
    classes.some((c) => c.classId === selectedClassId)
      ? selectedClassId
      : defaultClassId;

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
        isPlayer: d.isPlayer,
        position: d.classPosition ?? Number.MAX_SAFE_INTEGER,
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
          <Tooltip
            placement="bottom"
            content="Chooses which car class the graph plots. Gaps are measured to that class's leader, so only one class is shown at a time."
          >
            <select
              aria-label="Lap graph car class"
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
          </Tooltip>
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
