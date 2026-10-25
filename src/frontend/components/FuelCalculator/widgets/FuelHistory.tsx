import React, { useMemo } from 'react';
import type { FuelCalculatorSettings, FuelCalculation } from '../types';
import { MAX_LAP_HISTORY, useFuelStore } from '../FuelStore';
import { useDashboard } from '@irdashies/context';
import { formatFuel } from '../fuelCalculations';
import {
  ConsumptionGraphWidget,
  ConsumptionGraphData,
} from './ConsumptionGraphWidget';

interface FuelCalculatorWidgetProps {
  fuelData?: FuelCalculation | null;
  displayData?: FuelCalculation | null;
  fuelUnits: 'L' | 'gal';
  settings?: FuelCalculatorSettings;
  widgetId?: string;
  customStyles?: {
    fontSize?: number;
    labelFontSize?: number;
    valueFontSize?: number;
    barFontSize?: number;
  };
  compactMode?: 'off' | 'compact' | 'ultra';
}

export const FuelHistory: React.FC<FuelCalculatorWidgetProps> = ({
  settings,
  fuelUnits,
  widgetId,
  customStyles,
  compactMode = 'off',
}) => {
  // Custom style handling
  const widgetStyle = useMemo(
    () =>
      customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) || {},
    [customStyles, widgetId, settings?.widgetStyles]
  );

  const styles = useMemo(() => {
    return {
      fontSize: widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : undefined,
    };
  }, [widgetStyle.fontSize]);

  // Access store directly to be self-contained
  const lapHistory = useFuelStore((state) => state.lapHistory);
  const projectionLaps = useFuelStore((state) => state.projectionLaps);
  const currentSessionNum = useFuelStore((state) => state.sessionNum);
  const { isDemoMode } = useDashboard();

  // Default to histogram if not specified in settings
  const fuelHistoryType = settings?.fuelHistoryType || 'histogram';

  const configuredLapCount = settings?.fuelHistoryLapCount;
  const tableLapCount =
    typeof configuredLapCount === 'number' &&
    Number.isFinite(configuredLapCount)
      ? Math.max(1, Math.min(MAX_LAP_HISTORY, Math.floor(configuredLapCount)))
      : 5;
  const tableLaps = useMemo(() => {
    if (fuelHistoryType !== 'table') return [];
    // The lap-number map can overwrite a new race lap with a preserved qualifying lap.
    const history = projectionLaps.length
      ? projectionLaps
      : Array.from(lapHistory.values());
    return history
      .filter(
        (lap) =>
          !lap.isHistorical &&
          (currentSessionNum < 0 || lap.sessionNum === currentSessionNum) &&
          lap.lapNumber >= 1 &&
          Number.isFinite(lap.fuelUsed) &&
          lap.fuelUsed > 0
      )
      .sort((a, b) => b.timestamp - a.timestamp || b.lapNumber - a.lapNumber)
      .slice(0, tableLapCount);
  }, [
    lapHistory,
    projectionLaps,
    currentSessionNum,
    tableLapCount,
    fuelHistoryType,
  ]);

  const graphData = useMemo(() => {
    if (fuelHistoryType === 'table') return null;
    const lapCount = fuelHistoryType === 'line' ? 30 : 15; // default to fewer for compact
    // Convert Map to array and sort by lap number descending
    const history = Array.from(lapHistory.values()).sort(
      (a, b) => b.lapNumber - a.lapNumber
    );

    // Filter to valid laps (not out-laps) and take last N
    // Allow Lap 1 even if it's an out-lap (e.g. standing start) as long as it has valid fuel data
    const validLaps = history
      .filter(
        (lap) => (!lap.isOutLap || lap.lapNumber >= 1) && lap.fuelUsed > 0
      )
      .slice(0, lapCount)
      .reverse(); // Oldest to newest for graph

    if (validLaps.length < 2) return null;

    const fuelValues = validLaps.map((lap) => lap.fuelUsed);
    const avgFuel =
      fuelValues.reduce((sum, v) => sum + v, 0) / fuelValues.length;
    const minFuel = Math.min(...fuelValues);
    const maxFuel = Math.max(...fuelValues);

    return {
      laps: validLaps,
      fuelValues,
      avgFuel,
      minFuel,
      maxFuel,
    } as ConsumptionGraphData;
  }, [lapHistory, fuelHistoryType]);

  if (settings && settings.showFuelHistory === false) return null;

  const paddingClass =
    compactMode === 'ultra' ? '' : compactMode === 'compact' ? 'p-1' : 'p-2';

  if (fuelHistoryType === 'table') {
    const labelFontSize = widgetStyle.labelFontSize || widgetStyle.fontSize;
    const valueFontSize = widgetStyle.valueFontSize || widgetStyle.fontSize;
    // Demo values stay explicitly labelled and never enter the lap store.
    const rows = isDemoMode
      ? Array.from({ length: tableLapCount }, (_, index) => ({
          lapNumber: tableLapCount - index,
          sessionNum: currentSessionNum,
          timestamp: 0,
          fuelUsed: [3.9, 3.85, 3.92, 3.88, 3.91][index % 5],
        }))
      : tableLaps;

    return (
      <div
        style={styles}
        className={`${paddingClass} ${compactMode !== 'off' ? 'mt-1 mb-0.5' : 'mt-2 mb-1'} w-full min-w-0`}
      >
        <div
          className="mb-1 flex items-center justify-between text-xs font-bold uppercase text-slate-400"
          style={{ fontSize: labelFontSize }}
        >
          <span>Fuel History</span>
          {isDemoMode && <span className="text-amber-400">Preview</span>}
        </div>
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Fuel used per completed lap</caption>
          <thead
            className="text-xs text-slate-400"
            style={{ fontSize: labelFontSize }}
          >
            <tr className="border-b border-slate-700/50">
              <th scope="col" className="py-1 text-left font-normal">
                Lap
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                Fuel Used
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-100" style={{ fontSize: valueFontSize }}>
            {rows.map((lap) => (
              <tr
                key={`${lap.sessionNum ?? 'unknown'}:${lap.lapNumber}:${lap.timestamp}`}
                className="border-b border-slate-700/30 last:border-0"
              >
                <td className={compactMode === 'off' ? 'py-1' : 'py-0.5'}>
                  {lap.lapNumber}
                </td>
                <td className="text-right">
                  {formatFuel(lap.fuelUsed, fuelUnits)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="py-2 text-center text-xs text-slate-400"
                >
                  Waiting for a completed lap
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      style={styles}
      className={`${paddingClass} ${compactMode !== 'off' ? 'mt-1 mb-0.5' : 'mt-2 mb-1'} w-full flex-1 min-h-[60px] flex flex-col`}
    >
      <ConsumptionGraphWidget
        graphData={isDemoMode ? null : graphData}
        consumptionGraphType={fuelHistoryType}
        fuelUnits={fuelUnits}
        showConsumptionGraph={true}
        editMode={false}
        manualTarget={settings?.manualTarget}
        height={settings?.widgetStyles?.[widgetId || '']?.height}
        labelFontSize={widgetStyle?.labelFontSize || widgetStyle?.fontSize}
        valueFontSize={widgetStyle?.valueFontSize || widgetStyle?.fontSize}
        barFontSize={widgetStyle?.barFontSize}
      />
    </div>
  );
};
