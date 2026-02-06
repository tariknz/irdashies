import React, { useMemo, useState, useEffect } from 'react';
import {
  useSessionVisibility,
  useTelemetryValue,
  useDashboard,
} from '@irdashies/context';
import { useFuelCalculation } from './useFuelCalculation';
import {
  FuelCalculatorHeader,
  FuelCalculatorGauge,
  FuelCalculatorConsumptionGrid,
  FuelCalculatorPitScenarios,
  FuelCalculatorTimeEmpty,
  FuelHistory,
  FuelCalculatorTargetMessage,
  FuelCalculatorConfidence,
  FuelCalculatorEconomyPredict,
} from './widgets/FuelCalculatorWidgets';
import type { FuelCalculatorSettings, FuelCalculation } from './types';
import type { LayoutNode } from '../Settings/types';
import { DEFAULT_FUEL_LAYOUT_TREE } from './defaults';

type FuelCalculatorProps = Partial<FuelCalculatorSettings>;

const EMPTY_DATA: FuelCalculation = {
  fuelLevel: 0,
  lastLapUsage: 0,
  avgLaps: 0,
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
  confidence: 'low',
  pitWindowOpen: 0,
  pitWindowClose: 0,
  currentLap: 0,
  fuelAtFinish: 0,
  avgLapTime: 0,
  projectedLapUsage: 0,
  maxQualify: null,
  fuelStatus: 'safe',
};

// --- Data & Calculation ---
export const FuelCalculator = (props: FuelCalculatorProps) => {
  // Replay Logic - REMOVED

  // Use specific settings from props or defaults (though this component usually receives merged settings or direct usage)
  // For standard usage in a dashboard widget, we should grab global settings context?
  // In `FuelCalculator.tsx` it did `useFuelSettings()` then merged.
  // Here we are likely passed `settings` directly from `WidgetRenderer` if used there, OR we need to fetch them.
  // The `FuelSettings.tsx` updates `currentDashboard.widgets`.
  // The `WidgetRenderer` likely passes `settings.config` as props to the component.
  // Let's assume `props` contains the configuration.

  // NOTE: In standard usage, we might be inside a provider or context.
  // But let's follow the pattern:

  const settings = props as FuelCalculatorSettings;

  const { fuelUnits, safetyMargin } = settings;

  const isSessionVisible = useSessionVisibility(settings.sessionVisibility);

  // Visual Edit Mode & Demo Mode
  const { editMode, currentDashboard } = useDashboard();
  const generalSettings = currentDashboard?.generalSettings;

  // Derived Settings based on General linkage
  const derivedCompactMode = settings.useGeneralCompactMode
    ? (generalSettings?.compactMode ?? false)
    : false;

  const derivedFontStyles = useMemo(() => {
    if (!settings.useGeneralFontSize || !generalSettings?.fontSize) {
      return settings.widgetStyles || {};
    }

    // Map general font size preset to pixel values
    const sizeMap: Record<
      string,
      { label: number; value: number; bar: number }
    > = {
      xs: { label: 8, value: 12, bar: 6 },
      sm: { label: 10, value: 14, bar: 8 },
      md: { label: 12, value: 18, bar: 10 },
      lg: { label: 14, value: 22, bar: 12 },
      xl: { label: 16, value: 26, bar: 14 },
      '2xl': { label: 18, value: 30, bar: 16 },
      '3xl': { label: 20, value: 34, bar: 18 },
    };

    const preset = sizeMap[generalSettings.fontSize] || sizeMap['sm'];

    // Return a virtual style object that all widgets will use
    // We simulate that every widget requested via widgetId gets these same sizes
    return new Proxy(
      {},
      {
        get: () => ({
          labelFontSize: preset.label,
          valueFontSize: preset.value,
          barFontSize: preset.bar,
        }),
      }
    ) as Record<
      string,
      {
        fontSize?: number;
        labelFontSize?: number;
        valueFontSize?: number;
        barFontSize?: number;
        height?: number;
      }
    >;
  }, [
    settings.useGeneralFontSize,
    settings.widgetStyles,
    generalSettings?.fontSize,
  ]);

  // We need to parse the layout if it's a string or use the object directly
  // However, `DEFAULT_FUEL_LAYOUT_TREE` is a const.
  // In `FuelSettings` we save `customLayout`.
  // If `settings.customLayout` exists, use it.
  const layoutTree: LayoutNode = useMemo(() => {
    // Fallback to default structure based on `layout` prop (simple presets)
    // Or use the complex default tree
    return DEFAULT_FUEL_LAYOUT_TREE;
  }, []);

  const isOnTrack = useTelemetryValue('IsOnTrack');
  // const sessionId = useTelemetryValue('SessionUniqueID');

  // We need to force a re-render periodically or subscribe to data?
  // `useTelemetryValues` subscribes to the store.
  // `useFuelCalculation` subscribes to the store.
  // So components should update automatically.

  // HACK: To ensure updates even if only low-freq data changes
  // we might want to subscribe to a clock or sessionTime?
  const sessionTime = useTelemetryValue('SessionTime');

  // Also subscribe to specific fuel values to pass to sub-components?
  // `useFuelCalculation` returns the calculation object.
  const fuelData = useFuelCalculation(safetyMargin, settings);

  // We should also consume the "Live" data from the store for direct display if needed
  // BUT `useFuelCalculation` already provides the computed state.

  // For the GRID, we want to show PREDICTIVE vs ACTUAL vs REQUIRED
  // `fuelData` has `fuelToFinish`, `fuelToAdd`, etc.

  // Laps Remaining from Telemetry vs Calculated
  // Telemetry: FuelLevel / FuelUsePerHour? No iRacing gives FuelLevelPct.
  // We rely on our calculation.

  const currentFuelLevel = useTelemetryValue('FuelLevel');

  // Pit Window
  // If we have `fuelData.pitWindowOpen` (lap number), we can show it.

  // Predictive Usage (for the grid)
  // `fuelData.avgLaps` is the average consumption.
  // We might want `fuelData.lastLapUsage` for comparison.

  const predictiveUsage = fuelData?.projectedLapUsage || 0;
  const qualifyConsumption = fuelData?.maxQualify || null;

  // --- Frozen Snapshot Logic ---
  // When not on track (and not in edit mode), we might want to "freeze" the data
  // so the driver can see the last calculated values (e.g. while in the pits).
  // `useFuelCalculation` handles some of this via `enableStorage`.
  // Here we just display what `fuelData` gives us.

  // However, when we are in the pits, `FuelLevel` might go up (refueling).
  // If `FuelLevel` changes, `fuelData` updates.
  // We want the "Fuel To Add" to update dynamically as we refuel.
  // This is handled by `fuelToAdd = target - current`. So it IS dynamic.

  // The ONLY thing we might want to freeze is the "Consumption" stats if we want to read them.
  // But usually we always want live data.

  // Snapshot for "At Pit Entry" vs "Now"?
  // The user didn't ask for this yet.

  // Snapshot for "At Pit Entry" vs "Now"?
  // The user didn't ask for this yet.

  // --- Display Data ---
  // We want to format data for the widgets.
  const displayData = useMemo(() => {
    if (!fuelData) return EMPTY_DATA;

    // Enhance with any extra derived state if needed
    return fuelData;
  }, [fuelData]);

  // Handle "Snapshot" for the Grid when in Pits
  // If we are in the pits, we might want to see the "Plan" based on valid laps,
  // not based on the idle fuel usage.
  // `useFuelCalculation` filters out invalid laps.
  // So `avgLaps` should remain stable.

  // But `fuelLevel` changes.
  // We want to pass `currentFuelLevel` explicitly?
  // `fuelData` already contains `fuelLevel` from the hook.

  // For the "Fuel Grid", we generally want stable numbers.
  // Let's rely on `fuelData`.

  // --- Session State Handling ---
  // If we change session (Practice -> Race), we want to reset?
  // `useFuelCalculation` handles session transitions.

  // --- UI Refresh Rate ---
  // We might want to throttle updates if performance is an issue.
  // But strict React should be fine.

  // --- Snapshot on Pit Entry ---
  // To allow the driver to see "Fuel at Pit Entry" vs "Fuel Now".
  // This is useful for "Fuel Added".
  const sessionState = useTelemetryValue('SessionState');
  const sessionFlags = useTelemetryValue('SessionFlags');

  const [frozenFuelData, setFrozenFuelData] = useState(fuelData);

  // When crossing into pit lane, snapshot?
  // Or just rely on `fuelData` which is live.
  // Actually, existing dashboards often FREEZE the "Laps Remaining" calculation when in pits
  // so it doesn't fluctuate with idle fuel usage (if any).
  // But our calculation uses "Avg Laps", which is stable.
  // The only moving part is "Fuel Level".
  // So "Laps Remaining" = CurrentFuel / Avg.
  // This is correct: as we refuel, laps remaining increases.

  // So we probably don't need to freeze unless the user wants to see "Stint Summary".

  // Update frozen data only when valid (e.g. on track)
  // Or update always?
  // Let's stick to live `fuelData`.
  /*
    useEffect(() => {
        if (isOnTrack) {
            setFrozenFuelData(fuelData);
        }
    }, [fuelData, isOnTrack]);
    */
  // Actually, let's just alias it for now.
  // If `fuelData` is null (initial load), use null.
  // But we want to persist the last known good data if possible?
  // `useFuelCalculation` returns `initialCalculation` if no data.

  useEffect(() => {
    if (fuelData) {
      setFrozenFuelData((prev) => {
        // Update snapshot if:
        // 1. We don't have a previous snapshot
        // 2. The current lap has changed
        // 3. The last finished lap count has changed (crucial for catching the update after crossing the line)
        if (
          !prev ||
          prev.currentLap !== fuelData.currentLap ||
          prev.lastFinishedLap !== fuelData.lastFinishedLap
        ) {
          return fuelData;
        }
        return prev;
      });
    }
  }, [fuelData]);

  // Force update every second for time-based items (like clock) if needed?
  // Not needed if we use `sessionTime`.

  // Layout Debug
  // console.log('Layout Tree:', layoutTree);

  // We need to support "Blinking" or "Alerts".
  // `FuelCalculatorTargetMessage` handles this internally via `fuelData.fuelStatus`.

  // --- Widget Renderer ---
  // Recursive function to build the grid

  // We need to manage the "Blinking" state for the border.
  // We can do this with CSS animation or React state.
  // Let's use CSS transitions based on `fuelStatus`.

  // Add timeout to force re-render if connection is lost?
  // No, `useTelemetryvalues` handles that.

  // Add simple "Heartbeat" to ensure smooth gauge updates?
  // The gauge animates via CSS/SVG transitions.

  // The gauge animates via CSS/SVG transitions.

  // Frozen Display Data (for Grid)
  const frozenDisplayData = useMemo(() => {
    if (!frozenFuelData) {
      return EMPTY_DATA;
    }

    const level = frozenFuelData.fuelLevel;
    const avgFuelPerLap = frozenFuelData.avgLaps || frozenFuelData.lastLapUsage;
    const lapsWithFuel = avgFuelPerLap > 0 ? level / avgFuelPerLap : 0;
    const fuelAtFinish = level - frozenFuelData.lapsRemaining * avgFuelPerLap;

    return {
      ...frozenFuelData,
      fuelLevel: level,
      lapsWithFuel,
      pitWindowClose: frozenFuelData.currentLap + lapsWithFuel - 1,
      fuelAtFinish,
      targetScenarios: frozenFuelData.targetScenarios,
      maxQualify: qualifyConsumption,
    };
  }, [frozenFuelData, qualifyConsumption]);

  // Helper for safety check later
  const hasSettings = !!settings;

  // Render Loop
  // We use `requestAnimationFrame` for smooth updates if we were doing canvas.
  // For DOM, React updates are sufficient.

  // HACK: Sometimes `fuelData` is stale if no telemetry update.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTick((t) => t + 1);
    }, 1000); // 1Hz fallback refresh
    return () => clearTimeout(timeoutId);
  });
  
  // Also sync with `SessionTime` for faster updates
  useEffect(() => {
     // This effect runs whenever sessionTime changes (approx 60Hz or 20Hz depending on app setting)
     // We can trigger a re-render if necessary, but changing state `tick` above does it slowly.
     // `useTelemetryValue` hooks trigger renders on change anyway.
  }, [sessionTime]);


  // HACK: Re-implement the blinking/updates properly
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const scheduleNextUpdate = () => {
      timeoutId = setTimeout(() => {
        setTick((t) => t + 1);
        scheduleNextUpdate();
      }, 100);
    };

    // Start the cycle
    scheduleNextUpdate();

    return () => clearTimeout(timeoutId);
  }, [sessionState, sessionFlags]);

  // Safety fallback
  if (!hasSettings) return <div className="text-red-500">Missing Settings</div>;


  if (!editMode && settings?.showOnlyWhenOnTrack && !isOnTrack) return null;
  if (!editMode && !isSessionVisible) return <></>;

  const renderWidget = (widgetId: string) => {
    const widgetStyles = derivedFontStyles[widgetId] || derivedFontStyles; // Proxy or direct
    const widgetProps = {
      widgetId: widgetId,
      fuelData: fuelData,
      displayData: displayData,
      fuelUnits: fuelUnits,
      settings: settings,
      customStyles: widgetStyles,
      isCompact: derivedCompactMode,
    };

    switch (widgetId) {
      case 'fuelHeader':
        return <FuelCalculatorHeader {...widgetProps} />;
      case 'fuelGauge':
        return <FuelCalculatorGauge {...widgetProps} />;
      case 'fuelGrid':
        return (
          <FuelCalculatorConsumptionGrid
            {...widgetProps}
            fuelData={frozenFuelData}
            liveFuelData={fuelData}
            liveFuelLevel={currentFuelLevel}
            predictiveUsage={predictiveUsage}
            displayData={frozenDisplayData}
          />
        );
      case 'fuelScenarios':
        return (
          <FuelCalculatorPitScenarios
            {...widgetProps}
            fuelData={frozenFuelData}
            displayData={frozenDisplayData}
          />
        );
      case 'fuelTimeEmpty':
        return <FuelCalculatorTimeEmpty {...widgetProps} />;
      case 'fuelGraph':
      case 'historyGraph':
        return <FuelHistory {...widgetProps} />;
      case 'fuelTargetMessage':
        return (
          <FuelCalculatorTargetMessage
            {...widgetProps}
            fuelData={frozenFuelData}
            displayData={frozenDisplayData}
          />
        );
      case 'fuelConfidence':
        return <FuelCalculatorConfidence {...widgetProps} />;

      case 'fuelEconomyPredict':
        return (
          <FuelCalculatorEconomyPredict
            {...widgetProps}
            fuelData={frozenFuelData}
            displayData={displayData}
          />
        );
      default:
        return null;
    }
  };

  const RecursiveWidgetRenderer = ({ node }: { node: LayoutNode }) => {
    if (!node || !node.type) return null;
    if (node.type === 'box') {
      const isHorizontalBox = node.direction === 'row';
      return (
        <div
          className="flex-1 flex flex-col min-h-[50px] justify-center w-full"
          style={{ flexGrow: node.weight || 1 }}
        >
          <div
            className={`flex flex-1 ${isHorizontalBox ? 'flex-row items-center justify-around' : 'flex-col'} w-full`}
          >
            {Array.from(new Set(node.widgets || [])).map((widgetId) => (
              <div
                key={widgetId}
                data-widget-id={widgetId}
                className="flex-1 min-w-0 flex flex-col justify-center w-full"
              >
                {renderWidget(widgetId)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (node.type === 'split') {
      return (
        <div
          className={`flex flex-1 gap-1 ${node.direction === 'row' ? 'flex-row items-center' : 'flex-col'} h-full`}
        >
          {node.children?.map((child: LayoutNode) => (
            <RecursiveWidgetRenderer key={child.id} node={child} />
          ))}
        </div>
      );
    }
    return null;
  };

  // Background opacity configuration
  const bgAlpha = (settings?.background?.opacity ?? 95) / 100;

  const fuelStatusBasis = displayData.fuelStatus || 'safe';
  const showFuelStatusBorder = settings.showFuelStatusBorder ?? true;

  // Extract hex codes for inline style
  const borderColorValue = showFuelStatusBorder
    ? fuelStatusBasis === 'caution'
      ? '#f97316'
      : fuelStatusBasis === 'danger'
        ? '#ef4444'
        : '#22c55e'
    : 'transparent';

  const shadowColorValue = showFuelStatusBorder
    ? fuelStatusBasis === 'caution'
      ? 'rgba(249, 115, 22, 0.3)'
      : fuelStatusBasis === 'danger'
        ? 'rgba(239, 68, 68, 0.3)'
        : 'rgba(34, 197, 94, 0.3)'
    : 'none';

  // Static styling since we removed blinkState
  const backgroundStyle: React.CSSProperties = {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        ...backgroundStyle,
      }}
    >
      <div
        className={`border-2 w-full h-full flex flex-col box-border px-3 transition-colors duration-500`}
        style={{
          backgroundColor: `rgba(30, 30, 50, ${bgAlpha})`,
          borderColor: borderColorValue,
          boxShadow: `0 0 15px ${shadowColorValue} inset`,
        }}
      >
        {layoutTree ? (
          <RecursiveWidgetRenderer node={layoutTree} />
        ) : (
          <div className="text-red-500">Layout Error</div>
        )}
      </div>
    </div>
  );
};
