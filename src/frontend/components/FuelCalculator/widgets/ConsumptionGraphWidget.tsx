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

  // Use dummy graph data for placeholder
  const effectiveGraphData = graphData || {
      maxFuel: 3.5,
      avgFuel: 2.8,
      fuelValues: []
  };

  const { maxFuel, avgFuel, fuelValues } = effectiveGraphData;

  return (
    <div className="flex-1 flex flex-col justify-center min-w-[120px] w-full min-h-[60px]">
      <div className="text-[10px] text-slate-400 uppercase mb-1">
        History
      </div>
      <div className="h-10 relative flex-1">
        {consumptionGraphType === 'histogram'
          ? (() => {
              const yMax = maxFuel * 1.15;
              const avgYPct = (avgFuel / yMax) * 100;
              return (
                <div className="w-full h-full flex items-end justify-center gap-px relative">
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-yellow-400/80"
                    style={{ bottom: `${avgYPct}%` }}
                  />
                  {fuelValues.slice(0, 20).map((fuel: number, i: number) => {
                    const heightPct = (fuel / yMax) * 100;
                    const isAboveAvg = fuel > avgFuel;
                    return (
                      <div
                        key={i}
                        className={`w-[3px] ${isAboveAvg ? 'bg-red-400' : 'bg-green-400'}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    );
                  })}
                </div>
              );
            })()
          : (() => {
              const yMax = maxFuel * 1.15;
              const points = fuelValues
                .slice(0, 10)
                .map((fuel: number, i: number) => {
                  const xPct =
                    (i /
                      (Math.min(10, fuelValues.length) - 1)) *
                    100;
                  const yPct = (fuel / yMax) * 100;
                  return { xPct, yPct };
                });
              return (
                <svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 w-full h-full"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={points
                      .map((p: any) => `${p.xPct},${100 - p.yPct}`)
                      .join(' ')}
                    fill="none"
                    stroke="rgba(74, 222, 128, 0.8)"
                    strokeWidth="2"
                  />
                </svg>
              );
            })()}
      </div>
      <div className="text-[9px] text-slate-400 text-center mt-1">
        Avg: {formatFuel(avgFuel, fuelUnits)}
      </div>
    </div>
  );
};
