/**
 * Main Fuel Calculator Component
 * Displays fuel consumption and pit stop information
 */

import { useMemo } from 'react';
import { useTelemetryValues } from '@irdashies/context';
import { useFuelCalculation } from './useFuelCalculation';
import { formatFuel } from './fuelCalculations';
import { useFuelStore } from './FuelStore';
import type { FuelCalculatorSettings } from './types';

type FuelCalculatorProps = Partial<FuelCalculatorSettings>;

export const FuelCalculator = ({
  fuelUnits = 'L',
  layout = 'vertical',
  showConsumption = true,
  showMin = true,
  showLastLap = true,
  show3LapAvg = true,
  show10LapAvg = true,
  showMax = true,
  showPitWindow = true,
  // showFuelSave = true, // Commented out - unused while Fuel Save section is disabled
  showFuelRequired = false,
  showConsumptionGraph = true,
  consumptionGraphType = 'histogram',
  safetyMargin = 0.05,
  background = { opacity: 85 },
}: FuelCalculatorProps) => {
  const fuelData = useFuelCalculation(safetyMargin);
  // Subscribe to lapHistory directly to trigger re-renders when it changes
  const lapHistory = useFuelStore((state) => state.lapHistory);

  // Get current fuel level from telemetry even when no lap data
  const currentFuelLevel = useTelemetryValues('FuelLevel')?.[0] || 0;

  // Get laps of fuel consumption for the graph
  const graphData = useMemo(() => {
    const lapCount = consumptionGraphType === 'histogram' ? 30 : 5;
    // Convert Map to array and sort by lap number descending
    const history = Array.from(lapHistory.values()).sort(
      (a, b) => b.lapNumber - a.lapNumber
    );

    // Get first lap number to exclude it (pace lap or first lap after reset)
    const allLaps = history.filter(lap => lap.fuelUsed > 0);
    const firstLapNumber = allLaps.length > 0
      ? Math.min(...allLaps.map(l => l.lapNumber))
      : 0;

    // Filter to valid laps (not out-laps and not first lap) and take last N
    const validLaps = history
      .filter(lap => !lap.isOutLap && lap.fuelUsed > 0 && lap.lapNumber !== firstLapNumber)
      .slice(0, lapCount)
      .reverse(); // Oldest to newest for graph

    if (validLaps.length < 2) return null;

    const fuelValues = validLaps.map(lap => lap.fuelUsed);
    const avgFuel = fuelValues.reduce((sum, v) => sum + v, 0) / fuelValues.length;
    const minFuel = Math.min(...fuelValues);
    const maxFuel = Math.max(...fuelValues);

    return {
      laps: validLaps,
      fuelValues,
      avgFuel,
      minFuel,
      maxFuel,
    };
  }, [lapHistory, consumptionGraphType]);

  // Determine status border and glow colors
  const statusClasses = useMemo(() => {
    if (!fuelData) return 'border-slate-600';
    if (fuelData.canFinish) return 'border-green-500 shadow-[0_0_15px_rgba(0,255,0,0.2)]';
    if (fuelData.pitWindowClose - fuelData.currentLap < 5)
      return 'border-red-500 shadow-[0_0_15px_rgba(255,48,48,0.3)]';
    return 'border-orange-500 shadow-[0_0_15px_rgba(255,165,0,0.2)]';
  }, [fuelData]);

  // Create display data - use fuelData if available, otherwise show current fuel
  const displayData = useMemo(() => {
    if (!fuelData) {
      // No lap data yet - just show current fuel level
      return {
        fuelLevel: currentFuelLevel,
        lastLapUsage: 0,
        avg3Laps: 0,
        avg10Laps: 0,
        avgAllGreenLaps: 0,
        minLapUsage: 0,
        maxLapUsage: 0,
        lapsWithFuel: 0,
        lapsRemaining: 0,
        totalLaps: 0,
        fuelToFinish: 0,
        fuelToAdd: 0,
        canFinish: false,
        targetConsumption: 0,
        confidence: 'low' as const,
        pitWindowOpen: 0,
        pitWindowClose: 0,
        currentLap: 0,
        fuelAtFinish: 0,
        avgLapTime: 0,
      };
    }

    // If fuel level changed (e.g., in garage), recalculate laps with new fuel
    if (Math.abs(fuelData.fuelLevel - currentFuelLevel) > 0.1) {
      const avgFuelPerLap = fuelData.avg3Laps || fuelData.lastLapUsage;
      const lapsWithFuel = avgFuelPerLap > 0 ? currentFuelLevel / avgFuelPerLap : 0;
      const fuelAtFinish = currentFuelLevel - (fuelData.lapsRemaining * avgFuelPerLap);

      return {
        ...fuelData,
        fuelLevel: currentFuelLevel,
        lapsWithFuel,
        pitWindowClose: fuelData.currentLap + lapsWithFuel - 1,
        fuelAtFinish,
      };
    }

    return fuelData;
  }, [fuelData, currentFuelLevel]);

  // Calculate fuel required for different consumption rates
  const fuelRequired = useMemo(() => {
    if (!fuelData || fuelData.lapsRemaining <= 0) return null;

    return {
      min: fuelData.minLapUsage * fuelData.lapsRemaining,
      avg: (fuelData.avg10Laps || fuelData.avg3Laps) * fuelData.lapsRemaining,
      max: fuelData.maxLapUsage * fuelData.lapsRemaining,
    };
  }, [fuelData]);

  // Determine base classes based on layout
  const containerClasses = layout === 'horizontal'
    ? 'w-full max-w-[300px] max-h-[200px]'
    : 'w-full';

  const textSizeClasses = layout === 'horizontal'
    ? 'text-xs'
    : 'text-base';

  const headerFontSize = layout === 'horizontal'
    ? 'text-[1.5em]'
    : 'text-[2.5em]';

  return (
    <div
      className={`${containerClasses} bg-slate-800/[var(--bg-opacity)] rounded-sm p-3 text-white ${textSizeClasses} border-2 transition-all duration-300 ${statusClasses} overflow-hidden`}
      style={
        {
          '--bg-opacity': `${background.opacity}%`,
        } as React.CSSProperties
      }
    >
      {/* Header: Current Fuel Level and Laps */}
      <div className={`flex flex-col items-center ${layout === 'horizontal' ? 'pb-1 mb-1' : 'pb-3 mb-3'} border-b border-slate-600/50 gap-2`}>
        <div className="flex justify-around w-full gap-4">
          {/* Fuel Level */}
          <div className="flex flex-col items-center flex-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Fuel</div>
            <div className="flex items-baseline gap-1.5">
              <span className={`${headerFontSize} font-semibold text-green-400 [text-shadow:_0_0_10px_rgba(0,255,0,0.5)] leading-none`}>
                {formatFuel(displayData.fuelLevel, fuelUnits, 1).split(' ')[0]}
              </span>
              <span className="text-xs text-slate-500">{fuelUnits}</span>
            </div>
          </div>
          {/* Laps Remaining */}
          <div className="flex flex-col items-center flex-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Laps</div>
            <div className="flex items-baseline gap-1.5">
              <span className={`${headerFontSize} font-semibold text-green-400 [text-shadow:_0_0_10px_rgba(0,255,0,0.5)] leading-none`}>
                {displayData.lapsWithFuel.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Fuel Consumption & Required Table */}
      {showConsumption && (
        <div className={`${layout === 'horizontal' ? 'mb-1 pb-1' : 'mb-3 pb-2'} border-b border-slate-600/30`}>
          {/* Table Header */}
          <div className="grid grid-cols-3 gap-1 mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wide"></span>
            <span className="text-xs text-slate-500 uppercase tracking-wide text-right">Per Lap</span>
            {showFuelRequired && fuelRequired && (
              <span className="text-xs text-slate-500 uppercase tracking-wide text-right">To Finish</span>
            )}
          </div>
          {/* Table Rows */}
          {showMin && (
            <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
              <span className="text-slate-400 text-xs">Min</span>
              <span className="text-white text-sm font-medium text-right">
                {formatFuel(displayData.minLapUsage, fuelUnits)}
              </span>
              {showFuelRequired && fuelRequired && (
                <span className="text-green-400 text-sm font-medium text-right">
                  {formatFuel(fuelRequired.min, fuelUnits, 1)}
                </span>
              )}
            </div>
          )}
          {showLastLap && (
            <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
              <span className="text-slate-400 text-xs">Last Lap</span>
              <span className="text-white text-sm font-medium text-right">
                {formatFuel(displayData.lastLapUsage, fuelUnits)}
              </span>
              {showFuelRequired && fuelRequired && fuelData && (
                <span className="text-white text-sm font-medium text-right">
                  {formatFuel(displayData.lastLapUsage * fuelData.lapsRemaining, fuelUnits, 1)}
                </span>
              )}
            </div>
          )}
          {show3LapAvg && (
            <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
              <span className="text-slate-400 text-xs">3 Lap Avg</span>
              <span className="text-white text-sm font-medium text-right">
                {formatFuel(displayData.avg3Laps, fuelUnits)}
              </span>
              {showFuelRequired && fuelRequired && fuelData && (
                <span className="text-cyan-400 text-sm font-medium text-right">
                  {formatFuel(displayData.avg3Laps * fuelData.lapsRemaining, fuelUnits, 1)}
                </span>
              )}
            </div>
          )}
          {show10LapAvg && (
            <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
              <span className="text-slate-400 text-xs">10 Lap Avg</span>
              <span className="text-white text-sm font-medium text-right">
                {formatFuel(displayData.avg10Laps, fuelUnits)}
              </span>
              {showFuelRequired && fuelRequired && (
                <span className="text-yellow-400 text-sm font-medium text-right">
                  {formatFuel(fuelRequired.avg, fuelUnits, 1)}
                </span>
              )}
            </div>
          )}
          {showMax && (
            <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
              <span className="text-slate-400 text-xs">Max</span>
              <span className="text-white text-sm font-medium text-right">
                {formatFuel(displayData.maxLapUsage, fuelUnits)}
              </span>
              {showFuelRequired && fuelRequired && (
                <span className="text-orange-400 text-sm font-medium text-right">
                  {formatFuel(fuelRequired.max, fuelUnits, 1)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pit Window */}
      {showPitWindow && fuelData && (
        <div className={`${layout === 'horizontal' ? 'mb-1 pb-1' : 'mb-3 pb-2'} border-b border-slate-600/30`}>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pit Window</div>
          <div className="mt-2">
            <div className="h-6 bg-slate-900/80 rounded-xl relative mb-1.5 border border-slate-600/50 overflow-hidden">
              <div
                className="absolute h-full bg-gradient-to-r from-orange-500/30 to-orange-500/60 rounded-xl transition-all duration-300"
                style={{
                  left: `${((displayData.pitWindowOpen - displayData.currentLap) / (fuelData.lapsRemaining || 1)) * 100}%`,
                  width: `${((displayData.pitWindowClose - displayData.pitWindowOpen) / (fuelData.lapsRemaining || 1)) * 100}%`,
                }}
              />
              <div
                className="absolute w-0.5 h-full bg-green-400 shadow-[0_0_10px_rgba(0,255,0,0.8)] z-10"
                style={{ left: '0%' }}
              />
            </div>
            <div className="text-center text-xs text-slate-400">
              {displayData.canFinish
                ? 'No pit stop needed'
                : `Lap ${displayData.pitWindowOpen} - ${displayData.pitWindowClose.toFixed(1)}`}
            </div>
          </div>
        </div>
      )}

      {/* Fuel Consumption Graph */}
      {showConsumptionGraph && (
        <div className={`${layout === 'horizontal' ? 'mb-1 pb-1' : 'mb-3 pb-2'} border-b border-slate-600/30`}>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Consumption History</div>
          {graphData ? (
          <>
            <div className="h-12 relative">
              {consumptionGraphType === 'histogram' ? (
              // Histogram view - bars for each lap
              (() => {
                const range = graphData.maxFuel - graphData.minFuel;
                const padding = range * 0.1 || 0.1;
                const yMin = graphData.minFuel - padding;
                const yMax = graphData.maxFuel + padding;
                const avgYPct = ((graphData.avgFuel - yMin) / (yMax - yMin)) * 100;

                return (
                  <div className="w-full h-full flex items-end justify-center gap-[1px] relative">
                    {/* Average line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-yellow-400/80"
                      style={{ bottom: `${avgYPct}%` }}
                    />
                    {/* Bars */}
                    {graphData.fuelValues.map((fuel, i) => {
                      const heightPct = ((fuel - yMin) / (yMax - yMin)) * 100;
                      const isAboveAvg = fuel > graphData.avgFuel;
                      return (
                        <div
                          key={i}
                          className={`w-[2px] ${isAboveAvg ? 'bg-red-400' : 'bg-green-400'}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              // Line chart view
              (() => {
                const range = graphData.maxFuel - graphData.minFuel;
                const padding = range * 0.1 || 0.1;
                const yMin = graphData.minFuel - padding;
                const yMax = graphData.maxFuel + padding;
                const avgYPct = ((graphData.avgFuel - yMin) / (yMax - yMin)) * 100;
                const points = graphData.fuelValues.map((fuel, i) => {
                  const xPct = (i / (graphData.fuelValues.length - 1)) * 100;
                  const yPct = ((fuel - yMin) / (yMax - yMin)) * 100;
                  return { xPct, yPct };
                });

                return (
                  <>
                    {/* SVG for lines only - stretched to fill */}
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      {/* Average line */}
                      <line
                        x1="0"
                        y1={100 - avgYPct}
                        x2="100"
                        y2={100 - avgYPct}
                        stroke="rgba(251, 191, 36, 0.8)"
                        strokeWidth="1"
                        strokeDasharray="4,3"
                      />
                      {/* Data line */}
                      <polyline
                        points={points.map(p => `${p.xPct},${100 - p.yPct}`).join(' ')}
                        fill="none"
                        stroke="rgba(74, 222, 128, 0.8)"
                        strokeWidth="1.5"
                      />
                    </svg>
                    {/* Circles positioned absolutely to maintain shape */}
                    {points.map((p, i) => (
                      <div
                        key={i}
                        className="absolute w-2 h-2 bg-green-400 rounded-full border border-green-300 transform -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${p.xPct}%`,
                          top: `${100 - p.yPct}%`,
                        }}
                      />
                    ))}
                  </>
                );
              })()
              )}
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>L{graphData.laps[0]?.lapNumber}</span>
              <span className="text-yellow-400">Avg: {formatFuel(graphData.avgFuel, fuelUnits)}</span>
              <span>L{graphData.laps[graphData.laps.length - 1]?.lapNumber}</span>
            </div>
          </>
          ) : (
            <div className="h-12 flex items-center justify-center text-xs text-slate-500">
              Waiting for lap data...
            </div>
          )}
        </div>
      )}

      {/* Fuel Save Indicator - Commented out for now
      {showFuelSave && fuelData && displayData.targetConsumption > 0 && (
        <div className={`${layout === 'horizontal' ? 'mb-1 pb-1' : 'mb-3 pb-2'} border-b border-slate-600/30`}>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fuel Save</div>
          <div className="mt-2">
            <div className="h-4 bg-gradient-to-r from-green-400 via-yellow-500 to-red-500 rounded-lg relative mb-1.5">
              <div className="absolute left-1/2 w-0.5 h-full bg-white transform -translate-x-1/2" />
              <div
                className="absolute w-2.5 h-2.5 rounded-full top-0.5 bg-white border-2 border-slate-800 transform -translate-x-1/2 transition-all duration-300 shadow-[0_0_5px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${Math.min(100, Math.max(0, ((displayData.lastLapUsage / displayData.targetConsumption - 0.5) / 1.0) * 100 + 50))}%`,
                }}
              />
            </div>
            <div className={`text-center text-xs font-medium ${displayData.lastLapUsage > displayData.targetConsumption ? 'text-red-400' : 'text-green-400'}`}>
              {displayData.lastLapUsage > displayData.targetConsumption
                ? `${formatFuel(displayData.lastLapUsage - displayData.targetConsumption, fuelUnits)} over`
                : `${formatFuel(displayData.targetConsumption - displayData.lastLapUsage, fuelUnits)} under`}
            </div>
          </div>
        </div>
      )}
      */}


      {/* Footer: Key Information */}
      <div className={`flex justify-around ${layout === 'horizontal' ? 'pt-1 mt-1' : 'pt-3 mt-2'} border-t border-slate-600/50 gap-3`}>
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xs text-slate-400 uppercase">To Finish</span>
          <span className="text-sm font-semibold text-green-400">
            {formatFuel(displayData.fuelToFinish, fuelUnits, 1)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xs text-slate-400 uppercase">At Finish</span>
          <span className={`text-sm font-semibold ${displayData.fuelAtFinish >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {displayData.fuelAtFinish >= 0 ? '+' : ''}{formatFuel(Math.abs(displayData.fuelAtFinish), fuelUnits, 1)}
          </span>
        </div>
        {displayData.fuelToAdd > 0 && (
          <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs text-slate-400 uppercase">Add at Stop</span>
            <span className="text-sm font-semibold text-green-400">
              {formatFuel(displayData.fuelToAdd, fuelUnits, 1)}
            </span>
          </div>
        )}
        {displayData.avgLapTime > 0 && displayData.lapsWithFuel > 0 && (
          <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs text-slate-400 uppercase">Time Empty</span>
            <span className="text-sm font-semibold text-cyan-400">
              {(() => {
                const totalSeconds = Math.floor(displayData.lapsWithFuel * displayData.avgLapTime);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
              })()}
            </span>
          </div>
        )}
      </div>

      {/* Confidence Indicator - only show when we have actual data */}
      {fuelData && displayData.confidence !== 'high' && (
        <div className="mt-2 px-1.5 py-1.5 bg-orange-500/10 border-l-2 border-orange-500 text-xs text-orange-400 text-center rounded">
          {displayData.confidence === 'low'
            ? 'Low confidence - need more laps'
            : 'Medium confidence'}
        </div>
      )}

      {/* Garage Preview Indicator - show when we have lap data but fuel changed */}
      {fuelData && Math.abs(fuelData.fuelLevel - currentFuelLevel) > 0.1 && (
        <div className="mt-2 px-2 py-2 bg-blue-500/15 border-2 border-blue-500 text-xs font-semibold text-blue-400 text-center rounded-md animate-pulse">
          🔧 Garage Preview - Fuel adjusted to {formatFuel(currentFuelLevel, fuelUnits, 1)}
        </div>
      )}
    </div>
  );
};
