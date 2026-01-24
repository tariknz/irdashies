/**
 * Main Fuel Calculator Component
 * Displays fuel consumption and pit stop information
 */

import { useMemo } from 'react';
import {
  useTelemetryValues,
  useSessionVisibility,
  useTelemetryValue,
  useDashboard,
} from '@irdashies/context';
import { useFuelCalculation } from './useFuelCalculation';
import { formatFuel } from './fuelCalculations';
import type { FuelCalculatorSettings, BoxConfig } from './types';
import type { LayoutNode } from '../Settings/types';
import { useFuelSettings } from '../Standings/hooks';
import { useFuelStore } from './FuelStore';
import { Box } from '../Box/Box';
import {
  FuelLevelWidget,
  LapsRemainingWidget,
  FuelHeaderCombinedWidget,
} from './widgets/FuelHeaderWidgets';
import { ConsumptionWidget } from './widgets/ConsumptionWidget';
import { KeyInfoWidget } from './widgets/KeyInfoWidget';
import {
  EnduranceStrategyWidget,
  PitWindowWidget,
} from './widgets/StrategyWidgets';
import { FuelScenariosWidget } from './widgets/FuelScenariosWidget';
import { ConsumptionGraphWidget } from './widgets/ConsumptionGraphWidget';
import { ConfidenceWidget } from './widgets/ConfidenceWidget';

type FuelCalculatorProps = Partial<FuelCalculatorSettings>;

export const FuelCalculator = (props: FuelCalculatorProps) => {
  const globalSettings = useFuelSettings();

  // Merge props with global settings, prioritizing props
  const settings = useMemo(() => {
    return {
      fuelUnits: props.fuelUnits ?? globalSettings?.fuelUnits ?? 'L',
      layout: props.layout ?? globalSettings?.layout ?? 'vertical',
      showConsumption: props.showConsumption ?? globalSettings?.showConsumption ?? true,
      showMin: props.showMin ?? globalSettings?.showMin ?? true,
      showLastLap: props.showLastLap ?? globalSettings?.showLastLap ?? true,
      show3LapAvg: props.show3LapAvg ?? globalSettings?.show3LapAvg ?? true,
      show10LapAvg: props.show10LapAvg ?? globalSettings?.show10LapAvg ?? true,
      showPitWindow: props.showPitWindow ?? globalSettings?.showPitWindow ?? true,
      showEnduranceStrategy: props.showEnduranceStrategy ?? globalSettings?.showEnduranceStrategy ?? false,
      showFuelScenarios: props.showFuelScenarios ?? globalSettings?.showFuelScenarios ?? true,
      showFuelRequired: props.showFuelRequired ?? globalSettings?.showFuelRequired ?? false,
      showConsumptionGraph: props.showConsumptionGraph ?? globalSettings?.showConsumptionGraph ?? true,
      consumptionGraphType: props.consumptionGraphType ?? globalSettings?.consumptionGraphType ?? 'histogram',
      safetyMargin: props.safetyMargin ?? globalSettings?.safetyMargin ?? 0.05,
      background: {
        opacity: props.background?.opacity ?? globalSettings?.background?.opacity ?? 85
      },
      fuelRequiredMode: props.fuelRequiredMode ?? globalSettings?.fuelRequiredMode ?? 'toFinish',
      showOnlyWhenOnTrack: props.showOnlyWhenOnTrack ?? globalSettings?.showOnlyWhenOnTrack ?? true,
      showFuelLevel: props.showFuelLevel ?? globalSettings?.showFuelLevel ?? true,
      showLapsRemaining: props.showLapsRemaining ?? globalSettings?.showLapsRemaining ?? true,
      layoutTree: (props as any).layoutTree ?? globalSettings?.layoutTree,
      layoutConfig: (props as any).layoutConfig ?? globalSettings?.layoutConfig,
      sessionVisibility: (props as any).sessionVisibility ?? globalSettings?.sessionVisibility,
    };
  }, [props, globalSettings]);

  const {
    fuelUnits,
    layout,
    showConsumption,
    showMin,
    showLastLap,
    show3LapAvg,
    show10LapAvg,
    showPitWindow,
    showEnduranceStrategy,
    showFuelScenarios,
    showFuelRequired,
    showConsumptionGraph,
    consumptionGraphType,
    safetyMargin,
    fuelRequiredMode,
    showFuelLevel,
    showLapsRemaining,
  } = settings;

  const isSessionVisible = useSessionVisibility(settings.sessionVisibility);
  const fuelData = useFuelCalculation(safetyMargin);
  // Subscribe to lapHistory directly to trigger re-renders when it changes
  const lapHistory = useFuelStore((state) => state.lapHistory);

  // Get current fuel level from telemetry even when no lap data
  const currentFuelLevel = useTelemetryValues('FuelLevel')?.[0] || 0;
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;

  // Visual Edit Mode: Get editMode from dashboard context
  const { editMode } = useDashboard();

  // Get laps of fuel consumption for the graph
  const graphData = useMemo(() => {
    const lapCount = consumptionGraphType === 'histogram' ? 30 : 5;
    // Convert Map to array and sort by lap number descending
    const history = Array.from(lapHistory.values()).sort(
      (a, b) => b.lapNumber - a.lapNumber
    );

    // Filter to valid laps (not out-laps) and take last N
    const validLaps = history
      .filter((lap) => !lap.isOutLap && lap.fuelUsed > 0)
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
    };
  }, [lapHistory, consumptionGraphType]);

  // Determine status border and glow colors
  const statusClasses = useMemo(() => {
    if (!fuelData) return 'border-slate-600';

    const lapsUntilPit = fuelData.pitWindowClose - fuelData.currentLap;
    const isLastStint = fuelData.stopsRemaining === 0;
    const fuelIsTight = fuelData.fuelAtFinish < fuelData.fuelToFinish * 0.1;

    if (lapsUntilPit <= 1) {
      return 'border-red-500 shadow-[0_0_15px_rgba(255,48,48,0.3)]';
    }
    if (lapsUntilPit <= 5 || (isLastStint && fuelIsTight)) {
      return 'border-orange-500 shadow-[0_0_15px_rgba(255,165,0,0.2)]';
    }
    return 'border-green-500 shadow-[0_0_15px_rgba(0,255,0,0.2)]';
  }, [fuelData]);

  const headerTextClasses = useMemo(() => {
    if (!fuelData)
      return 'text-white [text-shadow:_0_0_10px_rgba(255,255,255,0.3)]';

    const lapsUntilPit = fuelData.pitWindowClose - fuelData.currentLap;
    const isLastStint = fuelData.stopsRemaining === 0;
    const fuelIsTight = fuelData.fuelAtFinish < fuelData.fuelToFinish * 0.1;

    if (lapsUntilPit <= 1) {
      return 'text-red-400 [text-shadow:_0_0_10px_rgba(255,48,48,0.5)]';
    }
    if (lapsUntilPit <= 5 || (isLastStint && fuelIsTight)) {
      return 'text-orange-400 [text-shadow:_0_0_10px_rgba(255,165,0,0.5)]';
    }
    return 'text-green-400 [text-shadow:_0_0_10px_rgba(0,255,0,0.5)]';
  }, [fuelData]);

  const displayData = useMemo(() => {
    if (!fuelData) {
      return {
        fuelLevel: currentFuelLevel, lastLapUsage: 0, avg3Laps: 0, avg10Laps: 0,
        avgAllGreenLaps: 0, minLapUsage: 0, maxLapUsage: 0, lapsWithFuel: 0,
        lapsRemaining: 0, totalLaps: 0, fuelToFinish: 0, fuelToAdd: 0,
        canFinish: false, targetConsumption: 0, confidence: 'low' as const,
        pitWindowOpen: 0, pitWindowClose: 0, currentLap: 0, fuelAtFinish: 0,
        avgLapTime: 0, targetScenarios: undefined,
      };
    }

    if (Math.abs(fuelData.fuelLevel - currentFuelLevel) > 0.1) {
      const avgFuelPerLap = fuelData.avg3Laps || fuelData.lastLapUsage;
      const lapsWithFuel = avgFuelPerLap > 0 ? currentFuelLevel / avgFuelPerLap : 0;
      const fuelAtFinish = currentFuelLevel - fuelData.lapsRemaining * avgFuelPerLap;
      const targetScenarios: typeof fuelData.targetScenarios = [];
      if (lapsWithFuel >= 0.5) {
        const currentLapTarget = Math.round(lapsWithFuel);
        const scenarios = [currentLapTarget - 1, currentLapTarget, currentLapTarget + 1].filter(n => n > 0);
        for (const lapCount of scenarios) {
          targetScenarios.push({ laps: lapCount, fuelPerLap: currentFuelLevel / lapCount, isCurrentTarget: lapCount === currentLapTarget });
        }
      }
      return { ...fuelData, fuelLevel: currentFuelLevel, lapsWithFuel, pitWindowClose: fuelData.currentLap + lapsWithFuel - 1, fuelAtFinish, targetScenarios };
    }
    return fuelData;
  }, [fuelData, currentFuelLevel]);

  const fuelMetrics = useMemo(() => {
    if (!fuelData || fuelData.lapsRemaining <= 0) return null;
    const rates = { min: fuelData.minLapUsage, last: displayData.lastLapUsage, avg3: displayData.avg3Laps, avg: fuelData.avg10Laps || fuelData.avg3Laps, max: fuelData.maxLapUsage };
    const tankCapacity = fuelData.fuelTankCapacity ?? 60;
    const currentFuel = displayData.fuelLevel;
    const stopsRemaining = fuelData.stopsRemaining ?? 0;
    const metrics: Record<string, { toFinish: number; toAdd: number }> = {};
    for (const [key, rate] of Object.entries(rates)) {
      const toFinish = rate * fuelData.lapsRemaining * (1 + safetyMargin);
      let toAdd = stopsRemaining > 1 ? Math.max(0, tankCapacity - currentFuel) : Math.max(0, toFinish - currentFuel);
      metrics[key] = { toFinish, toAdd };
    }
    return metrics;
  }, [fuelData, safetyMargin, displayData]);

  const getToFinishColorClass = useMemo(() => {
    if (!fuelData) return () => 'text-white/70';
    return (fuelNeeded: number) => {
      const currentFuel = displayData.fuelLevel;
      const lapsUntilPit = fuelData.pitWindowClose - fuelData.currentLap;
      const isLastStint = fuelData.stopsRemaining === 0;
      const fuelIsTight = currentFuel < fuelNeeded * (1 + safetyMargin);
      if (lapsUntilPit <= 1 && fuelIsTight) return 'text-red-400/70';
      if (lapsUntilPit <= 5 || (isLastStint && fuelIsTight)) return 'text-orange-400/70';
      return 'text-green-400/70';
    };
  }, [fuelData, displayData.fuelLevel, safetyMargin]);

  // Determine effective layout tree
  const layoutTree = useMemo(() => {
    let tree: any = settings.layoutTree;

    if (!tree) {
      const layoutConfig = settings.layoutConfig;
      if (layoutConfig && layoutConfig.length > 0) {
        const legacyWidgetOrder = [
          'fuelLevel',
          'lapsRemaining',
          'consumption',
          'keyInfo',
          'endurance',
          'pitWindow',
          'scenarios',
          'graph',
          'confidence',
        ];
        const isLegacyDefault =
          layoutConfig.length === 1 &&
          layoutConfig[0].widgets.length === legacyWidgetOrder.length;
        if (isLegacyDefault) {
          if (layout === 'horizontal') {
            // Horizontal Default Layout
            const children: LayoutNode[] = [
              { id: 'header-box', type: 'box' as const, direction: 'col' as const, widgets: ['fuelHeader'], weight: 1 },
              { id: 'main-stats-box', type: 'box' as const, direction: 'row' as const, widgets: ['consumption', 'pitWindow', 'endurance', 'confidence'], weight: 3 },
              { id: 'scenarios-box', type: 'box' as const, direction: 'col' as const, widgets: ['scenarios'], weight: 1.5 },
            ];

            if (showConsumptionGraph) {
              children.push({ id: 'graph-box', type: 'box' as const, direction: 'col' as const, widgets: ['graph'], weight: 1.5 });
            }

            return {
              id: 'root-horizontal-default',
              type: 'split' as const,
              direction: 'row' as const,
              children,
            };
          }

          return {
            id: 'root-auto-upgraded',
            type: 'split' as const,
            direction: 'col' as const,
            children: [
              {
                id: 'header-box',
                type: 'box' as const,
                direction: 'row' as const,
                widgets: ['fuelHeader'],
                weight: 1,
              },
              {
                id: 'main-box',
                type: 'box' as const,
                direction: 'col' as const,
                widgets: legacyWidgetOrder.slice(2),
                weight: 4,
              },
            ],
          };
        }
        const children: LayoutNode[] = layoutConfig
          .map((box: BoxConfig) => {
            if (!box.widgets || box.widgets.length === 0) return null;
            return {
              id: box.id,
              type: 'box' as const,
              widgets: box.widgets,
              direction: box.flow === 'horizontal' ? 'row' : 'col',
              weight: 1,
            };
          })
          .filter(Boolean) as LayoutNode[];
        if (children.length === 1) tree = children[0];
        else
          tree = {
            id: 'root-migrated',
            type: 'split' as const,
            direction: layout === 'horizontal' ? 'row' : 'col',
            children,
          };
      }
    }

    if (!tree) {
      // Fallback default if nothing else is defined
      if (layout === 'horizontal') {
        return {
          id: 'root-horizontal-fallback',
          type: 'split' as const,
          direction: 'row' as const,
          children: [
            { id: 'header-box', type: 'box' as const, direction: 'col' as const, widgets: ['fuelHeader'], weight: 1 },
            { id: 'main-stats-box', type: 'box' as const, direction: 'row' as const, widgets: ['consumption', 'pitWindow', 'endurance'], weight: 3 },
            { id: 'scenarios-box', type: 'box' as const, direction: 'col' as const, widgets: ['scenarios'], weight: 1.5 }
          ]
        };
      }
    }

    if (!tree) return null;

    // CLONE tree to avoid mutating the settings object
    let workingTree = JSON.parse(JSON.stringify(tree));

    const normalizeNode = (node: any): LayoutNode => {
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
  }, [settings.layoutTree, settings.layoutConfig, layout, showConsumptionGraph]);


  if (!editMode && settings?.showOnlyWhenOnTrack && !isOnTrack) return null;
  if (!editMode && !isSessionVisible) return <></>;

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case 'fuelLevel': return showFuelLevel ? <FuelLevelWidget key="fuelLevel" fuelLevel={displayData.fuelLevel} fuelUnits={fuelUnits} layout={layout || 'vertical'} headerFontSize={layout === 'horizontal' ? 'text-xl' : 'text-3xl'} headerTextClasses={headerTextClasses} /> : null;
      case 'fuelHeader': return <FuelHeaderCombinedWidget key="fuelHeader" fuelLevel={displayData.fuelLevel} lapsRemaining={displayData.lapsWithFuel} fuelUnits={fuelUnits} headerFontSize={layout === 'horizontal' ? 'text-xl' : 'text-3xl'} headerTextClasses={headerTextClasses} showFuelLevel={showFuelLevel} showLapsRemaining={showLapsRemaining} />;
      case 'lapsRemaining': return showLapsRemaining ? <LapsRemainingWidget key="lapsRemaining" lapsRemaining={displayData.lapsWithFuel} headerFontSize={layout === 'horizontal' ? 'text-xl' : 'text-3xl'} headerTextClasses={headerTextClasses} /> : null;
      case 'consumption': return <ConsumptionWidget key="consumption" displayData={displayData} fuelMetrics={fuelMetrics} fuelUnits={fuelUnits} settings={settings} getToFinishColorClass={getToFinishColorClass} layout={layout || 'vertical'} />;
      case 'keyInfo': return <KeyInfoWidget key="keyInfo" displayData={displayData} fuelUnits={fuelUnits} />;
      case 'pitWindow': return <PitWindowWidget key="pitWindow" displayData={displayData} fuelData={fuelData} showPitWindow={showPitWindow} editMode={editMode} />;
      case 'endurance': return <EnduranceStrategyWidget key="endurance" fuelData={fuelData} displayData={displayData} showEnduranceStrategy={showEnduranceStrategy} editMode={editMode} />;
      case 'scenarios': return <FuelScenariosWidget key="scenarios" displayData={displayData} showFuelScenarios={showFuelScenarios} fuelUnits={fuelUnits} editMode={editMode} />;
      case 'graph': return <ConsumptionGraphWidget key="graph" graphData={graphData} consumptionGraphType={consumptionGraphType || 'histogram'} fuelUnits={fuelUnits} showConsumptionGraph={showConsumptionGraph} editMode={editMode} />;
      case 'confidence': return <ConfidenceWidget key="confidence" fuelData={fuelData} confidence={displayData.confidence} />;
      default: return null;
    }
  };

  const RecursiveWidgetRenderer = ({ node }: { node: LayoutNode }) => {
    if (!node || !node.type) return null;
    if (node.type === 'box') {
      const isHorizontalBox = node.direction === 'row';
      return (
        <div
          className="flex-1 flex flex-col m-0.5 min-h-[50px] justify-center"
          style={{ flexGrow: node.weight || 1 }}
        >
          <div className={`flex flex-1 ${isHorizontalBox ? 'flex-row items-center justify-around' : 'flex-col'} gap-1 p-1`}>
            {node.widgets?.map(widgetId => (
              <div key={widgetId} data-widget-id={widgetId} className="flex-1 min-w-0 flex flex-col items-center justify-center">
                {renderWidget(widgetId)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (node.type === 'split') {
      return (
        <div className={`flex flex-1 gap-1 ${node.direction === 'row' ? 'flex-row items-center' : 'flex-col'} h-full`}>
          {node.children?.map((child: LayoutNode) => <RecursiveWidgetRenderer key={child.id} node={child} />)}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="w-full h-full flex flex-col bg-slate-800/(--bg-opacity) text-white"
      style={{
        ['--bg-opacity' as string]: `${settings.background?.opacity ?? 85}%`,
      }}
    >
      <div className={`flex-1 overflow-y-auto min-h-0 ${layout === 'horizontal' ? 'flex items-center' : ''}`}>
        {layoutTree ? (
          <RecursiveWidgetRenderer node={layoutTree} />
        ) : (
          <div className="p-4 flex items-center justify-center h-full text-slate-500 italic text-xs">
            No layout defined. Use the editor in Settings.
          </div>
        )}
      </div>
    </div>
  );
};

