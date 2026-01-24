import React, { useMemo } from 'react';
import {
    useTelemetryValues,
    useSessionVisibility,
    useTelemetryValue,
    useDashboard,
} from '@irdashies/context';
import { useFuelCalculation } from './useFuelCalculation';
import {
    FuelCalculator2Header,
    FuelCalculator2Gauge,
    FuelCalculator2ConsumptionGrid,
    FuelCalculator2PitScenarios,
    FuelCalculator2TimeEmpty,
} from './widgets/FuelCalculator2Widgets';
import type { FuelCalculatorSettings } from './types';
import type { LayoutNode } from '../Settings/types';

type FuelCalculatorProps = Partial<FuelCalculatorSettings>;

export const FuelCalculator2 = (props: FuelCalculatorProps) => {
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

    const {
        fuelUnits,
        safetyMargin,
    } = settings;

    const isSessionVisible = useSessionVisibility(settings.sessionVisibility);

    // Visual Edit Mode & Demo Mode
    const { editMode, isDemoMode } = useDashboard();

    // Real Data
    const realFuelData = useFuelCalculation(safetyMargin);
    const realCurrentFuelLevel = useTelemetryValues('FuelLevel')?.[0] || 0;
    const realIsOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;

    // Mock Data for Demo Mode
    const [mockStateIndex, setMockStateIndex] = React.useState(0);

    // Cycle mock states
    React.useEffect(() => {
        if (!isDemoMode) return;
        const interval = setInterval(() => {
            setMockStateIndex(prev => (prev + 1) % 3);
        }, 5000);
        return () => clearInterval(interval);
    }, [isDemoMode]);

    // Scenario 1: Medium Confidence (Standard Race)
    const mockMedium: typeof realFuelData = {
        fuelLevel: 45.5,
        lastLapUsage: 3.2,
        avg3Laps: 3.15,
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
            { laps: 13, fuelPerLap: 3.50, isCurrentTarget: false },
            { laps: 14, fuelPerLap: 3.25, isCurrentTarget: true },
            { laps: 15, fuelPerLap: 3.03, isCurrentTarget: false },
        ]
    };

    // Scenario 2: High Confidence (Good flow, clear prediction)
    const mockHigh: typeof realFuelData = {
        ...mockMedium,
        fuelLevel: 58.0,
        lapsWithFuel: 19.2,
        currentLap: 10,
        lapsRemaining: 40,
        avg3Laps: 3.02,
        avg10Laps: 3.01,
        lastLapUsage: 3.01,
        confidence: 'high',
        stopsRemaining: 1,
        pitWindowOpen: 11,
        pitWindowClose: 29,
        targetScenarios: [
            { laps: 18, fuelPerLap: 3.22, isCurrentTarget: false },
            { laps: 19, fuelPerLap: 3.05, isCurrentTarget: true },
            { laps: 20, fuelPerLap: 2.90, isCurrentTarget: false },
        ]
    };

    // Scenario 3: Low Confidence / Critical (Pit window open, fuel tight)
    const mockCritical: typeof realFuelData = {
        ...mockMedium,
        fuelLevel: 5.5,
        lapsWithFuel: 1.8,
        currentLap: 30,
        lapsRemaining: 20,
        avg3Laps: 3.3, // High consumption!
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
        ]
    };

    // Empty/Default Data for when calculation is not yet available
    const emptyFuelData = {
        fuelLevel: realCurrentFuelLevel || 0,
        lastLapUsage: 0,
        avg3Laps: 0,
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
        targetScenarios: [] as { laps: number; fuelPerLap: number; isCurrentTarget: boolean; }[]
    };

    const mocks = [mockMedium, mockHigh, mockCritical];
    const mockFuelData = mocks[mockStateIndex];

    const fuelData = isDemoMode ? mockFuelData : (realFuelData || emptyFuelData);
    const currentFuelLevel = isDemoMode ? mockFuelData.fuelLevel : realCurrentFuelLevel;
    const isOnTrack = isDemoMode ? true : realIsOnTrack;

    // Display Data Calculation (Same as original calculator)
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


    // Determine effective layout tree
    const layoutTree = useMemo(() => {
        let tree: any = (settings as any).layoutTree;

        if (!tree) {
            // Default Fixed Layout if no tree in settings
            return {
                id: 'root-fuel2-default',
                type: 'split' as const,
                direction: 'col' as const,
                children: [
                    {
                        id: 'box-1',
                        type: 'box' as const,
                        direction: 'col' as const,
                        widgets: ['fuel2Header', 'fuel2Gauge', 'fuel2Grid', 'fuel2Scenarios', 'fuel2TimeEmpty'],
                        weight: 1
                    }
                ]
            };
        }

        // CLONE tree to avoid mutating the settings object
        let workingTree = JSON.parse(JSON.stringify(tree));
        // Normalize if needed (same logic as FuelCalculator)
        const normalizeNode = (node: any): LayoutNode => {
            if (!node) return node;
            if (node.type === 'widget') return { id: node.id, type: 'box' as const, widgets: [node.widgetId], direction: 'col' as const, weight: node.weight };
            if (node.type === 'split') return { ...node, children: node.children?.map(normalizeNode).filter(Boolean) || [] };
            return node;
        };
        return normalizeNode(workingTree);
    }, [settings]);

    // Snapshot for Consumption Grid (updates only on lap change)
    const [frozenFuelData, setFrozenFuelData] = React.useState(fuelData);

    React.useEffect(() => {
        // Update snapshot if lap changes or if we were using empty data (totalLaps 0)
        // This ensures we switch from placeholder to real data, and then only update on lap structure changes
        if (fuelData.currentLap !== frozenFuelData.currentLap || (frozenFuelData.totalLaps === 0 && fuelData.totalLaps > 0)) {
            setFrozenFuelData(fuelData);
        }
    }, [fuelData, frozenFuelData.currentLap, frozenFuelData.totalLaps]);

    if (!editMode && settings?.showOnlyWhenOnTrack && !isOnTrack) return null;
    if (!editMode && !isSessionVisible) return <></>;

    const renderWidget = (widgetId: string) => {
        switch (widgetId) {
            case 'fuel2Header':
            case 'modernHeader':
                return <FuelCalculator2Header key={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2Gauge':
            case 'modernGauge':
                return <FuelCalculator2Gauge key={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2Grid':
            case 'modernGrid':
                // Use frozen data for grid to avoid values jumping during lap
                return <FuelCalculator2ConsumptionGrid key={widgetId} fuelData={frozenFuelData} displayData={frozenFuelData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2Scenarios':
            case 'modernScenarios':
                return <FuelCalculator2PitScenarios key={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2TimeEmpty':
            case 'modernTimeEmpty':
                return <FuelCalculator2TimeEmpty key={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            default: return null;
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
                    <div className={`flex flex-1 ${isHorizontalBox ? 'flex-row items-center justify-around' : 'flex-col'} w-full`}>
                        {node.widgets?.map(widgetId => (
                            <div key={widgetId} data-widget-id={widgetId} className="flex-1 min-w-0 flex flex-col justify-center w-full">
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

    // Background opacity configuration
    const bgAlpha = (settings?.background?.opacity ?? 95) / 100;

    return (
        <div
            className="w-full h-full flex flex-col text-white"
            style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            }}
        >
            <div className="border-2 w-full h-full flex flex-col box-border px-3"
                style={{
                    backgroundColor: `rgba(30, 30, 50, ${bgAlpha})`,
                    borderColor: displayData.confidence === 'high' ? '#22c55e' :
                        displayData.confidence === 'medium' ? '#f97316' : '#ef4444',
                    boxShadow: displayData.confidence === 'high' ? '0 0 15px rgba(34, 197, 94, 0.3) inset' :
                        displayData.confidence === 'medium' ? '0 0 15px rgba(249, 115, 22, 0.3) inset' :
                            '0 0 15px rgba(239, 68, 68, 0.3) inset'
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
