import React, { useMemo } from 'react';
import {
  useTelemetryValues,
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
import { useFuelStore } from './FuelStore';
import type { FuelCalculatorSettings } from './types';
import type { LayoutNode } from '../Settings/types';
import { DEFAULT_FUEL_LAYOUT_TREE } from './defaults';

type FuelCalculatorProps = Partial<FuelCalculatorSettings>;

export const FuelCalculator = (props: FuelCalculatorProps) => {
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
  const { editMode, isDemoMode, currentDashboard } = useDashboard();
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

  // Store subscription for synchronization
  const storeLastLap = useFuelStore((state) => state.lastLap);
  const qualifyConsumption = useFuelStore((state) => state.qualifyConsumption);

  // Real Data
  const realFuelData = useFuelCalculation(safetyMargin, settings);
  // (Logging is now handled inside useFuelCalculation)

  const realCurrentFuelLevel = useTelemetryValues('FuelLevel')?.[0] || 0;
  const realIsOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;
  const onPitRoad = useTelemetryValue<boolean>('OnPitRoad') ?? false;
  const sessionState = useTelemetryValue('SessionState');
  const sessionFlags = useTelemetryValue('SessionFlags');

  // Mock Data for Demo Mode
  const [mockStateIndex, setMockStateIndex] = React.useState(0);

  // Cycle mock states
  React.useEffect(() => {
    if (!isDemoMode) return;
    const interval = setInterval(() => {
      setMockStateIndex((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, [isDemoMode]);

  // Scenario 1: Medium Confidence (Standard Race)
  const mockMedium: typeof realFuelData = {
    fuelLevel: 45.5,
    lastLapUsage: 3.2,
    avgLaps: 3.15,
    avg10Laps: 3.18,
    avgAllGreenLaps: 3.17,
    minLapUsage: 3.1,
    maxLapUsage: 3.4,
    lapsWithFuel: 14.3,
    lapsRemaining: 35,
    totalLaps: 50,
    currentLap: 15,
    fuelToFinish: 111.3,
    fuelToAdd: 65.8,
    pitWindowOpen: 16,
    pitWindowClose: 29,
    canFinish: false,
    targetConsumption: 1.3,
    confidence: 'medium',
    fuelAtFinish: -65.8,
    avgLapTime: 95.5,
    stopsRemaining: 1,
    lapsPerStint: 18,
    fuelTankCapacity: 60,
    targetScenarios: [
      { laps: 13, fuelPerLap: 3.5, isCurrentTarget: false },
      { laps: 14, fuelPerLap: 3.25, isCurrentTarget: true },
      { laps: 15, fuelPerLap: 3.03, isCurrentTarget: false },
    ],
    lastFinishedLap: 14,
    projectedLapUsage: 1.35,
    fuelStatus: 'danger',
    lapsRange: [13, 15],
    maxQualify: null,
  };

  // Scenario 2: High Confidence (Good flow, clear prediction)
  const mockHigh: typeof realFuelData = {
    ...mockMedium,
    fuelLevel: 58.0,
    lapsWithFuel: 19.2,
    currentLap: 10,
    lapsRemaining: 40,
    avgLaps: 3.02,
    avg10Laps: 3.01,
    lastLapUsage: 3.01,
    confidence: 'high',
    stopsRemaining: 1,
    pitWindowOpen: 11,
    pitWindowClose: 29,
    targetScenarios: [
      { laps: 18, fuelPerLap: 3.22, isCurrentTarget: false },
      { laps: 19, fuelPerLap: 3.05, isCurrentTarget: true },
      { laps: 20, fuelPerLap: 2.9, isCurrentTarget: false },
    ],
    fuelStatus: 'safe',
    lapsRange: [19, 19],
    maxQualify: null,
  };

  // Scenario 3: Low Confidence / Critical (Pit window open, fuel tight)
  const mockCritical: typeof realFuelData = {
    ...mockMedium,
    fuelLevel: 5.5,
    lapsWithFuel: 1.8,
    currentLap: 30,
    lapsRemaining: 20,
    avgLaps: 3.3, // High consumption!
    confidence: 'low',
    stopsRemaining: 1, // Need to pit NOW
    pitWindowOpen: 31, // Pit window is open
    pitWindowClose: 31, // Closing soon
    fuelToFinish: 66,
    fuelToAdd: 60, // Full tank needed
    targetScenarios: [
      { laps: 1, fuelPerLap: 5.5, isCurrentTarget: true },
      { laps: 2, fuelPerLap: 5.5, isCurrentTarget: false }, // Placeholder to keep layout stable
      { laps: 3, fuelPerLap: 5.5, isCurrentTarget: false }, // Placeholder to keep layout stable
    ],
    fuelStatus: 'danger',
    lapsRange: [0, 2],
    maxQualify: null,
  };

  // Empty/Default Data for when calculation is not yet available
  const emptyFuelData = {
    fuelLevel: realCurrentFuelLevel || 0,
    lastLapUsage: 0,
    avgLaps: 0,
    avg10Laps: 0,
    avgAllGreenLaps: 0,
    minLapUsage: 0,
    maxLapUsage: 0,
    lapsWithFuel: 0,
    lapsRemaining: 0,
    totalLaps: 0,
    currentLap: 0,
    fuelToFinish: 0,
    fuelToAdd: 0,
    pitWindowOpen: 0,
    pitWindowClose: 0,
    canFinish: false,
    targetConsumption: 0,
    confidence: 'low' as const,
    fuelAtFinish: 0,
    avgLapTime: 0,
    stopsRemaining: 0,
    lapsPerStint: 0,
    fuelTankCapacity: 60,
    targetScenarios: [] as {
      laps: number;
      fuelPerLap: number;
      isCurrentTarget: boolean;
    }[],
    lastFinishedLap: 0,
    projectedLapUsage: 0,
    fuelStatus: 'safe' as const,
    lapsRange: [0, 0] as [number, number],
    maxQualify: qualifyConsumption,
  };

  const mocks = [mockMedium, mockHigh, mockCritical];
  const mockFuelData = mocks[mockStateIndex];

  const fuelData = isDemoMode ? mockFuelData : realFuelData || emptyFuelData;
  const currentFuelLevel = isDemoMode
    ? mockFuelData.fuelLevel
    : realCurrentFuelLevel;
  const isOnTrack = isDemoMode ? true : realIsOnTrack;

  // Display Data Calculation (Same as original calculator)
  const displayData = useMemo(() => {
    if (!fuelData) {
      return {
        fuelLevel: currentFuelLevel,
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
        confidence: 'low' as const,
        pitWindowOpen: 0,
        pitWindowClose: 0,
        currentLap: 0,
        fuelAtFinish: 0,
        avgLapTime: 0,
        targetScenarios: undefined,
        fuelStatus: 'safe' as const,
        lapsRange: [0, 0] as [number, number],
        maxQualify: null,
      };
    }

    if (Math.abs(fuelData.fuelLevel - currentFuelLevel) > 0.1) {
      const avgFuelPerLap = fuelData.avgLaps || fuelData.lastLapUsage;
      const lapsWithFuel =
        avgFuelPerLap > 0 ? currentFuelLevel / avgFuelPerLap : 0;
      const fuelAtFinish =
        currentFuelLevel - fuelData.lapsRemaining * avgFuelPerLap;
      const targetScenarios: typeof fuelData.targetScenarios = [];
      return {
        ...fuelData,
        fuelLevel: currentFuelLevel,
        lapsWithFuel,
        pitWindowClose: fuelData.currentLap + lapsWithFuel - 1,
        fuelAtFinish,
        targetScenarios,
        fuelStatus: fuelData.fuelStatus,
        lapsRange: fuelData.lapsRange,
      };
    }
    return fuelData;
  }, [fuelData, currentFuelLevel]);

  // Determine effective layout tree
  const layoutTree = useMemo(() => {
    const tree = settings.layoutTree;

    if (!tree) {
      // Default Fixed Layout if no tree in settings
      return DEFAULT_FUEL_LAYOUT_TREE;
    }

    // CLONE tree to avoid mutating the settings object
    const workingTree = JSON.parse(JSON.stringify(tree));
    // Normalize if needed (same logic as FuelCalculator)

    const normalizeNode = (
      node:
        | LayoutNode
        | { type: 'widget'; id: string; widgetId: string; weight?: number }
    ): LayoutNode => {
      if (!node) return node;
      if (node.type === 'widget')
        return {
          id: node.id,
          type: 'box' as const,
          widgets: [node.widgetId],
          direction: 'col' as const,
          weight: node.weight,
        };
      if (node.type === 'split')
        return {
          ...node,
          children: node.children?.map(normalizeNode).filter(Boolean) || [],
        };
      return node;
    };
    return normalizeNode(workingTree);
  }, [settings]);

  const [frozenFuelData, setFrozenFuelData] = React.useState(fuelData);
  const prevOnPitRoadRef = React.useRef(onPitRoad);
  const fuelDataRef = React.useRef(fuelData);

  // Keep ref updated
  React.useEffect(() => {
    fuelDataRef.current = fuelData;
  }, [fuelData]);

  React.useEffect(() => {
    if (!fuelData) return;

    if (!frozenFuelData) {
      setFrozenFuelData(fuelData);
      return;
    }

    // Stop updates if race is over (State >= 6 is CoolDown/Results)
    // 0x0004 is Checkered Flag
    const isRaceOver =
      (sessionState && sessionState >= 6) ||
      (sessionFlags && sessionFlags & 0x0004);
    if (isRaceOver) return;

    const currentTelemetryLap = fuelData.currentLap;
    const frozenLap = frozenFuelData.currentLap;

    // Check if we have moved to a new lap OR if our frozen data is stale (history hasn't caught up yet)
    // This prevents locking in stale data if 'isStoreCaughtUp' triggers before 'fuelData' refreshes
    const isFrozenStale =
      frozenFuelData.lastFinishedLap !== undefined &&
      frozenFuelData.lastFinishedLap < currentTelemetryLap - 1;

    if (
      currentTelemetryLap !== frozenLap ||
      isFrozenStale ||
      (frozenFuelData.totalLaps === 0 && fuelData.totalLaps > 0)
    ) {
      // Check if calculation backend has caught up

      // 1. Happy path: The calculation has a lastFinishedLap that matches the previous lap
      const isHistoryCaughtUp =
        fuelData.lastFinishedLap === currentTelemetryLap - 1;

      // 2. Fallback path: The store explicitly says it's on the new lap (meaning processing finished),
      // even if history didn't update (e.g. invalid lap where lastFinishedLap remains old)
      const isStoreCaughtUp = storeLastLap === currentTelemetryLap;

      // 3. Early lap edge cases (L0/L1) where history might be empty/initial
      const isEarlyLap = currentTelemetryLap <= 1;

      // 4. Force update if we fell significantly behind (more than 1 lap)
      // This prevents freezing if the sync checks above fail for some reason (e.g. invalid laps)
      const isLagging = currentTelemetryLap - frozenLap > 1;

      // Only update if we have a "better" or "caught up" state
      // If we are just stale, wait for history to catch up or store to confirm
      if (
        isHistoryCaughtUp ||
        (isStoreCaughtUp && !isFrozenStale) ||
        isEarlyLap ||
        isLagging
      ) {
        // Note: We avoid updating on JUST isStoreCaughtUp if we are fixing staleness,
        // because we want to wait for the actual Data (history) to catch up if possible.
        // However, if history never updates (invalid lap), we might be stuck?
        // Solution: If store is caught up, we update.
        // But if we updated and it was still stale (race condition), the 'isFrozenStale' check
        // in the NEXT render will keep trying until 'isHistoryCaughtUp' becomes true.
        setFrozenFuelData(fuelData);
      } else if (isStoreCaughtUp) {
        // If store is caught up but history isn't (and we know we are stale), we should probably update
        // to show *at least* the correct currentLap count, even if usage stats are old?
        // YES, update. The 'isFrozenStale' check next frame will trigger again if usage is still old,
        // allowing us to overwrite with new usage when it arrives.
        setFrozenFuelData(fuelData);
      }
    }

    // Check for Pit Exit (update after 2 seconds to allow data to stabilize)
    const isPitExit = prevOnPitRoadRef.current && !onPitRoad;
    if (isPitExit) {
      setTimeout(() => {
        if (fuelDataRef.current) {
          setFrozenFuelData(fuelDataRef.current);
        }
      }, 3000);
    }
    prevOnPitRoadRef.current = onPitRoad;
  }, [
    fuelData,
    frozenFuelData,
    storeLastLap,
    onPitRoad,
    sessionFlags,
    sessionState,
  ]);

  // Throttled Predictive Usage (to update Grid 'CURR' row periodically without jitter)
  const [predictiveUsage, setPredictiveUsage] = React.useState(0);
  const latestUsageRef = React.useRef(0);

  // Keep ref updated with latest data
  React.useEffect(() => {
    if (fuelData) {
      latestUsageRef.current = fuelData.projectedLapUsage ?? 0;
    }
  }, [fuelData]);

  // Sample from ref on random interval (5-8 seconds)
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const scheduleNextUpdate = () => {
      // Random delay between 2000ms (2s) and 6000ms (6s)
      const randomDelay = Math.floor(Math.random() * (6000 - 2000 + 1)) + 2000;

      timeoutId = setTimeout(() => {
        // Stop if race is over
        const isRaceOver =
          (sessionState && sessionState >= 6) ||
          (sessionFlags && sessionFlags & 0x0004);
        if (!isRaceOver) {
          setPredictiveUsage(latestUsageRef.current);
          scheduleNextUpdate();
        }
      }, randomDelay);
    };

    // Start the cycle
    scheduleNextUpdate();

    return () => clearTimeout(timeoutId);
  }, [sessionState, sessionFlags]);

  // Frozen Display Data (for Grid)
  // Uses the frozen fuel level from the snapshot, NOT the live fuel level
  // This ensures Laps/Refuel/Finish calculations in the grid are static
  const frozenDisplayData = useMemo(() => {
    if (!frozenFuelData) {
      return {
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
        confidence: 'low' as const,
        pitWindowOpen: 0,
        pitWindowClose: 0,
        currentLap: 0,
        fuelAtFinish: 0,
        avgLapTime: 0,
        targetScenarios: undefined,
        projectedLapUsage: 0,
        maxQualify: null,
      };
    }

    // We use frozenFuelData.fuelLevel effectively
    // The logic below mirrors displayData but doesn't override with live currentFuelLevel
    const level = frozenFuelData.fuelLevel;
    const avgFuelPerLap = frozenFuelData.avgLaps || frozenFuelData.lastLapUsage;
    const lapsWithFuel = avgFuelPerLap > 0 ? level / avgFuelPerLap : 0;
    const fuelAtFinish = level - frozenFuelData.lapsRemaining * avgFuelPerLap;

    // We don't really need accurate scenarios for the grid, but let's keep shape consistent
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

  // Extract hex codes for inline style
  const borderColorValue =
    fuelStatusBasis === 'caution'
      ? '#f97316'
      : fuelStatusBasis === 'danger'
        ? '#ef4444'
        : '#22c55e';

  const shadowColorValue =
    fuelStatusBasis === 'caution'
      ? 'rgba(249, 115, 22, 0.3)'
      : fuelStatusBasis === 'danger'
        ? 'rgba(239, 68, 68, 0.3)'
        : 'rgba(34, 197, 94, 0.3)';

  return (
    <div
      className="w-full h-full flex flex-col text-white"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
