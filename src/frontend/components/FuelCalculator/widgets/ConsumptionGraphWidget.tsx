import { formatFuel } from '../fuelCalculations';

interface ConsumptionGraphWidgetProps {
  graphData: any;
  consumptionGraphType: 'line' | 'histogram';
  fuelUnits: 'L' | 'gal';
  showConsumptionGraph: boolean;
  editMode?: boolean;
}

export const ConsumptionGraphWidget = ({
  graphData,
  consumptionGraphType,
  fuelUnits,
  showConsumptionGraph,
  editMode
}: ConsumptionGraphWidgetProps) => {
  if (!showConsumptionGraph) return null;

  // Determine if we should show dummy data
  const isDummy = !graphData || !graphData.fuelValues || graphData.fuelValues.length < 2;

  // Use dummy graph data for placeholder in edit mode or when no data
  const effectiveGraphData = !isDummy ? graphData : {
    maxFuel: 3.5,
    avgFuel: 2.8,
    fuelValues: [2.5, 3.1, 2.7, 3.4, 2.9, 3.0, 2.6, 3.2, 2.8, 3.0, 2.5, 3.1, 2.7, 3.4, 2.9]
  };

  const { maxFuel, avgFuel, fuelValues } = effectiveGraphData;

  return (
    <div
      data-widget-id="history-graph"
      className={`flex-1 flex flex-col justify-center min-w-[120px] w-full min-h-[85px] transition-opacity duration-500 ${isDummy ? 'opacity-60' : 'opacity-100'}`}
    >
      <div className="text-[10px] text-slate-400 uppercase mb-1 flex justify-between items-center px-1">
        <span className="font-bold tracking-tight">Fuel History</span>
        {isDummy && <span className="text-[8px] text-amber-500 font-bold animate-pulse">TRACKING...</span>}
      </div>

      <div className="h-16 relative bg-black/40 rounded border border-slate-700/50 mx-1 overflow-hidden">
        {consumptionGraphType === 'histogram'
          ? (() => {
            const yMax = Math.max(maxFuel * 1.15, 0.1);
            const avgYPct = (avgFuel / yMax) * 100;
            const displayValues = fuelValues.slice(-30);

            return (
              <div className="w-full h-full flex items-end justify-center gap-px relative px-1">
                {/* Average Line */}
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-yellow-400/80 z-10 pointer-events-none"
                  style={{ bottom: `${avgYPct}%` }}
                >
                  <span className="absolute right-1 bottom-0.5 text-[7px] text-yellow-400 font-bold opacity-80 uppercase">avg</span>
                </div>

                {/* Histogram Bars */}
                {displayValues.map((fuel: number, i: number) => {
                  const heightPct = Math.max((fuel / yMax) * 100, 4);
                  const isAboveAvg = fuel > avgFuel;
                  return (
                    <div
                      key={`${i}-${fuel}-${heightPct}`}
                      className={`flex-1 min-w-[3px] max-w-[12px] rounded-t-[1px] transition-all duration-300 ${isAboveAvg
                          ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                          : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                        }`}
                      style={{ height: `${heightPct}%` }}
                    >
                      <div className="w-full h-full bg-white/10" />
                    </div>
                  );
                })}
              </div>
            );
          })()
          : (() => {
            const yMax = Math.max(maxFuel * 1.15, 0.1);
            const displayValues = fuelValues.slice(-10);
            if (displayValues.length < 2) {
              return <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500 italic">Recording lap data...</div>;
            }

            const points = displayValues.map((fuel: number, i: number) => {
              const xPct = (i / (displayValues.length - 1)) * 100;
              const yPct = (fuel / yMax) * 100;
              return { x: xPct, y: 100 - yPct };
            });

            const d = `M ${points.map((p: any) => `${p.x},${p.y}`).join(' L ')}`;

            return (
              <div className="w-full h-full relative">
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-yellow-400/30 z-0"
                  style={{ bottom: `${(avgFuel / yMax) * 100}%` }}
                />
                <svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 w-full h-full p-2"
                  preserveAspectRatio="none"
                >
                  <path
                    d={d}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]"
                  />
                </svg>
              </div>
            );
          })()}
      </div>

      <div className="text-[11px] font-bold text-slate-200 text-center mt-1.5 flex items-center justify-center gap-1.5">
        <span className="text-slate-500 font-normal uppercase text-[9px]">Avg</span>
        {formatFuel(avgFuel, fuelUnits)}
      </div>
    </div>
  );
};
