import { memo } from 'react';
import { formatFuel } from '../fuelCalculations';
import { FuelLapData } from '../types';

export interface ConsumptionGraphData {
  maxFuel: number;
  avgFuel: number;
  fuelValues: number[];
  minFuel?: number;
  laps?: FuelLapData[];
}

interface ConsumptionGraphWidgetProps {
  graphData: ConsumptionGraphData | null;
  consumptionGraphType: 'line' | 'histogram';
  fuelUnits: 'L' | 'gal';
  showConsumptionGraph: boolean;
  editMode?: boolean;
  manualTarget?: number;
  height?: number;
  labelFontSize?: number;
  valueFontSize?: number;
  barFontSize?: number;
}

export const ConsumptionGraphWidget = memo(
  ({
    graphData,
    consumptionGraphType,
    fuelUnits,
    showConsumptionGraph,
    manualTarget,
    height,
    labelFontSize,
    valueFontSize,
    barFontSize,
  }: ConsumptionGraphWidgetProps) => {
    if (!showConsumptionGraph) return null;

    // Determine if we should show dummy data
    const isDummy =
      !graphData || !graphData.fuelValues || graphData.fuelValues.length < 2;

    // Use dummy graph data for placeholder in edit mode or when no data
    const effectiveGraphData =
      !isDummy && graphData
        ? graphData
        : {
            maxFuel: 3.5,
            avgFuel: 2.8,
            fuelValues: [
              2.5, 3.1, 2.7, 3.4, 2.9, 3.0, 2.6, 3.2, 2.8, 3.0, 2.5, 3.1, 2.7,
              3.4, 2.9,
            ],
          };

    const { maxFuel, avgFuel, fuelValues } = effectiveGraphData;

    // Calculate Y Max based on max fuel and potentially manual target
    const rawYMax = Math.max(maxFuel * 1.15, 0.1);
    const yMax = manualTarget
      ? Math.max(rawYMax, manualTarget * 1.15)
      : rawYMax;

    const graphHeight = height ? `${height}px` : undefined;
    const heightClass = !height ? 'h-16' : '';

    // Font Sizes
    const titleSize = labelFontSize ? `${labelFontSize}px` : '10px';
    const axisLabelSize = labelFontSize ? `${labelFontSize * 0.7}px` : '7px';
    const legendLabelSize = labelFontSize ? `${labelFontSize * 0.9}px` : '9px';
    const legendValueSize = valueFontSize ? `${valueFontSize}px` : '11px';
    const barLabelSize = barFontSize
      ? `${barFontSize}px`
      : labelFontSize
        ? `${labelFontSize * 0.8}px`
        : '8px';

    return (
      <div
        data-widget-id="history-graph"
        className={`flex-1 flex flex-col justify-center min-w-[120px] w-full min-h-[85px] transition-opacity duration-500 ${isDummy ? 'opacity-60' : 'opacity-100'}`}
      >
        <div
          className="text-slate-400 uppercase mb-1 flex justify-between items-center px-1"
          style={{ fontSize: titleSize }}
        >
          <span className="font-bold tracking-tight">Fuel History</span>
          {isDummy && (
            <span
              className="text-amber-500 font-bold animate-pulse"
              style={{ fontSize: axisLabelSize }}
            >
              TRACKING...
            </span>
          )}
        </div>

        <div
          className={`${heightClass} relative bg-black/40 rounded border border-slate-700/50 mx-1 overflow-hidden`}
          style={{ height: graphHeight }}
        >
          {consumptionGraphType === 'histogram'
            ? (() => {
                const avgYPct = (avgFuel / yMax) * 100;
                const targetYPct = manualTarget
                  ? (manualTarget / yMax) * 100
                  : 0;
                const displayValues = fuelValues.slice(-30);

                return (
                  <div className="w-full h-full flex items-end justify-center gap-px relative px-1">
                    {/* Average Line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-yellow-400/80 z-10 pointer-events-none"
                      style={{ bottom: `${avgYPct}%` }}
                    >
                      <span
                        className="absolute right-1 bottom-0.5 text-yellow-400 font-bold opacity-80 uppercase"
                        style={{ fontSize: axisLabelSize }}
                      >
                        avg
                      </span>
                    </div>

                    {/* Target Line */}
                    {manualTarget && manualTarget > 0 && (
                      <div
                        className="absolute left-0 right-0 border-t border-cyan-400/80 z-20 pointer-events-none"
                        style={{ bottom: `${targetYPct}%` }}
                      >
                        <span
                          className="absolute left-1 bottom-0.5 text-cyan-400 font-bold opacity-80 uppercase"
                          style={{ fontSize: axisLabelSize }}
                        >
                          tgt
                        </span>
                      </div>
                    )}

                    {/* Histogram Bars */}
                    {displayValues.map((fuel: number, i: number) => {
                      const heightPct = Math.max((fuel / yMax) * 100, 4);
                      // Use target for color comparison if available, else average
                      const isHigh = manualTarget
                        ? fuel > manualTarget
                        : fuel > avgFuel;

                      return (
                        <div
                          key={`${i}-${fuel}-${heightPct}`}
                          className={`flex-1 min-w-[3px] max-w-[12px] rounded-t-[1px] transition-all duration-300 relative group ${
                            isHigh
                              ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                              : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        >
                          <div className="w-full h-full bg-white/10" />
                          {/* Difference Label */}
                          {manualTarget && manualTarget > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                              <span
                                className="transform -rotate-90 font-bold text-white/90 whitespace-nowrap drop-shadow-md"
                                style={{ fontSize: barLabelSize }}
                              >
                                {fuel - manualTarget > 0 ? '+' : ''}
                                {(fuel - manualTarget).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            : (() => {
                const displayValues = fuelValues.slice(-10);
                if (displayValues.length < 2) {
                  return (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500 italic">
                      Recording lap data...
                    </div>
                  );
                }

                const points = displayValues.map((fuel: number, i: number) => {
                  const xPct = (i / (displayValues.length - 1)) * 100;
                  const yPct = (fuel / yMax) * 100;
                  return { x: xPct, y: 100 - yPct };
                });

                const d = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;

                return (
                  <div className="w-full h-full relative">
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-yellow-400/30 z-0"
                      style={{ bottom: `${(avgFuel / yMax) * 100}%` }}
                    />
                    {/* Target Line - Line Chart */}
                    {manualTarget && manualTarget > 0 && (
                      <div
                        className="absolute left-0 right-0 border-t border-cyan-400/50 z-0"
                        style={{ bottom: `${(manualTarget / yMax) * 100}%` }}
                      />
                    )}

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

        <div
          className="text-slate-200 text-center mt-1.5 flex items-center justify-center gap-1.5"
          style={{ fontSize: legendValueSize, fontWeight: 'bold' }}
        >
          <span
            className="text-slate-500 font-normal uppercase"
            style={{ fontSize: legendLabelSize }}
          >
            Avg
          </span>
          {formatFuel(avgFuel, fuelUnits)}
          {manualTarget && manualTarget > 0 && (
            <>
              <span className="text-slate-600">|</span>
              <span
                className="text-cyan-500 font-normal uppercase"
                style={{ fontSize: legendLabelSize }}
              >
                Tgt
              </span>
              <span className="text-cyan-400">
                {formatFuel(manualTarget, fuelUnits)}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }
);

ConsumptionGraphWidget.displayName = 'ConsumptionGraphWidget';
