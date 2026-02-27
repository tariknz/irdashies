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

export const FuelCalculator = (props: FuelCalculatorProps) => {
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

  const layoutTree: LayoutNode = useMemo(() => {
    // If we have a custom layout tree in settings, use it
    if (
      settings.layoutTree &&
      (settings.layoutTree as Record<string, unknown>).type
    ) {
      return settings.layoutTree as LayoutNode;
    }

    // Fallback to default structure
    return DEFAULT_FUEL_LAYOUT_TREE;
  }, [settings.layoutTree]);

  const isOnTrack = useTelemetryValue('IsOnTrack');

  const fuelData = useFuelCalculation(safetyMargin, settings);

  const currentFuelLevel = useTelemetryValue('FuelLevel');

  const predictiveUsage = fuelData?.projectedLapUsage || 0;
  const qualifyConsumption = fuelData?.maxQualify || null;

  const displayData = useMemo(() => {
    if (!fuelData) return EMPTY_DATA;
    return fuelData;
  }, [fuelData]);

  // Frozen snapshot of fuel data, updated only on lap changes.
  // Used by grid/scenarios/target widgets so pit-entry numbers stay
  // stable while live fuel level changes during refuelling.
  const [frozenFuelData, setFrozenFuelData] = useState(fuelData);

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

  const hasSettings = !!settings;

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

  const currentFuelStatus = displayData.fuelStatus || 'safe';
  const showFuelStatusBorder = settings.showFuelStatusBorder ?? true;

  // Extract hex codes for inline style
  const borderColorValue = showFuelStatusBorder
    ? currentFuelStatus === 'caution'
      ? '#f97316'
      : currentFuelStatus === 'danger'
        ? '#ef4444'
        : '#22c55e'
    : 'rgba(71, 85, 105, 0.4)'; // Neutral inactive border

  const shadowColorValue = showFuelStatusBorder
    ? currentFuelStatus === 'caution'
      ? 'rgba(249, 115, 22, 0.3)'
      : currentFuelStatus === 'danger'
        ? 'rgba(239, 68, 68, 0.3)'
        : 'rgba(34, 197, 94, 0.3)'
    : 'none';

  const backgroundStyle: React.CSSProperties = {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
