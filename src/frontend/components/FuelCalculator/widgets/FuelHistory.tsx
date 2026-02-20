import { useMemo, memo } from 'react';
import type { FuelCalculatorWidgetProps } from '../types';
import { useFuelStore } from '../FuelStore';
import { useDashboard } from '@irdashies/context';
import {
  ConsumptionGraphWidget,
  ConsumptionGraphData,
} from './ConsumptionGraphWidget';

/* eslint-disable react/prop-types */

export const FuelHistory = memo<FuelCalculatorWidgetProps>(
  ({ settings, fuelUnits, widgetId, customStyles, isCompact }) => {
    // Custom style handling
    const widgetStyle = useMemo(
      () =>
        customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) || {},
      [customStyles, widgetId, settings?.widgetStyles]
    );

    const styles = useMemo(() => {
      return {
        fontSize: widgetStyle.fontSize
          ? `${widgetStyle.fontSize}px`
          : undefined,
      };
    }, [widgetStyle.fontSize]);

    // Access store directly to be self-contained
    const lapHistory = useFuelStore((state) => state.lapHistory);
    const { isDemoMode } = useDashboard();

    // Default to histogram if not specified in settings
    const fuelHistoryType = settings?.fuelHistoryType || 'histogram';

    const graphData = useMemo(() => {
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

    // Reuse the existing widget!
    if (settings && settings.showFuelHistory === false) return null;

    return (
      <div
        style={styles}
        className={`${isCompact ? 'mt-1 mb-0.5' : 'mt-2 mb-1'} w-full flex-1 min-h-[60px] flex flex-col`}
      >
        <ConsumptionGraphWidget
          graphData={isDemoMode ? null : graphData}
          consumptionGraphType={fuelHistoryType}
          fuelUnits={fuelUnits || 'L'}
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
  }
);

FuelHistory.displayName = 'FuelHistory';
