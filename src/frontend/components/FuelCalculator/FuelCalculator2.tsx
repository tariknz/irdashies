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
    FuelCalculator2HistoryGraph,
    FuelCalculator2TargetMessage,
    FuelCalculator2Confidence,
} from './widgets/FuelCalculator2Widgets';
import { useFuelStore } from './FuelStore';
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
    const realFuelData = useFuelCalculation(safetyMargin, settings);
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
        ],
        lastFinishedLap: 14,
        projectedLapUsage: 1.35,
        fuelStatus: 'danger',
        lapsRange: [13, 15]
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
        ],
        fuelStatus: 'safe',
        lapsRange: [19, 19]
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
        ],
        fuelStatus: 'danger',
        lapsRange: [0, 2]
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
        targetScenarios: [] as { laps: number; fuelPerLap: number; isCurrentTarget: boolean; }[],
        lastFinishedLap: 0,
        projectedLapUsage: 0,
        fuelStatus: 'safe' as const,
        lapsRange: [0, 0] as [number, number],
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
                fuelStatus: 'safe' as const, lapsRange: [0, 0] as [number, number],
            };
        }

        if (Math.abs(fuelData.fuelLevel - currentFuelLevel) > 0.1) {
            const avgFuelPerLap = fuelData.avg3Laps || fuelData.lastLapUsage;
            const lapsWithFuel = avgFuelPerLap > 0 ? currentFuelLevel / avgFuelPerLap : 0;
            const fuelAtFinish = currentFuelLevel - fuelData.lapsRemaining * avgFuelPerLap;
            const targetScenarios: typeof fuelData.targetScenarios = [];
            return {
                ...fuelData,
                fuelLevel: currentFuelLevel,
                lapsWithFuel,
                pitWindowClose: fuelData.currentLap + lapsWithFuel - 1,
                fuelAtFinish,
                targetScenarios,
                fuelStatus: fuelData.fuelStatus,
                lapsRange: fuelData.lapsRange
            };
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
                        widgets: ['fuel2Header', 'fuel2Confidence', 'fuel2Gauge', 'fuel2Grid', 'fuel2Scenarios', 'fuel2Graph', 'fuel2TimeEmpty'],
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

    // Store subscription for synchronization
    const storeLastLap = useFuelStore((state) => state.lastLap);

    // Snapshot for Consumption Grid (updates only on lap change)
    // We restore this to keep AVG/MAX/LAST rows static during the lap, as requested.
    const [frozenFuelData, setFrozenFuelData] = React.useState(fuelData);

    React.useEffect(() => {
        if (!fuelData) return;

        // Initialize if empty
        if (!frozenFuelData) {
            setFrozenFuelData(fuelData);
            return;
        }

        const currentTelemetryLap = fuelData.currentLap;
        const frozenLap = frozenFuelData.currentLap;

        // Check if we have moved to a new lap
        if (currentTelemetryLap !== frozenLap || (frozenFuelData.totalLaps === 0 && fuelData.totalLaps > 0)) {
            // Check if calculation backend has caught up

            // 1. Happy path: The calculation has a lastFinishedLap that matches the previous lap
            const isHistoryCaughtUp = fuelData.lastFinishedLap === currentTelemetryLap - 1;

            // 2. Fallback path: The store explicitly says it's on the new lap (meaning processing finished),
            // even if history didn't update (e.g. invalid lap where lastFinishedLap remains old)
            const isStoreCaughtUp = storeLastLap === currentTelemetryLap;

            // 3. Early lap edge cases (L0/L1) where history might be empty/initial
            const isEarlyLap = currentTelemetryLap <= 1;

            if (isHistoryCaughtUp || isStoreCaughtUp || isEarlyLap) {
                setFrozenFuelData(fuelData);
            }
        }
    }, [fuelData, frozenFuelData, storeLastLap]);

    // Throttled Predictive Usage (to update Grid 'CURR' row periodically without jitter)
    const [predictiveUsage, setPredictiveUsage] = React.useState(0);
    const latestUsageRef = React.useRef(0);

    // Keep ref updated with latest data
    React.useEffect(() => {
        if (fuelData) {
            latestUsageRef.current = fuelData.projectedLapUsage ?? 0;
        }
    }, [fuelData?.projectedLapUsage]);

    // Sample from ref on random interval (5-8 seconds)
    React.useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const scheduleNextUpdate = () => {
            // Random delay between 2000ms (2s) and 6000ms (6s)
            const randomDelay = Math.floor(Math.random() * (6000 - 2000 + 1)) + 2000;

            timeoutId = setTimeout(() => {
                setPredictiveUsage(latestUsageRef.current);
                scheduleNextUpdate();
            }, randomDelay);
        };

        // Start the cycle
        scheduleNextUpdate();

        return () => clearTimeout(timeoutId);
    }, []);

    // Frozen Display Data (for Grid)
    // Uses the frozen fuel level from the snapshot, NOT the live fuel level
    // This ensures Laps/Refuel/Finish calculations in the grid are static
    const frozenDisplayData = useMemo(() => {
        if (!frozenFuelData) {
            return {
                fuelLevel: 0, lastLapUsage: 0, avg3Laps: 0, avg10Laps: 0,
                avgAllGreenLaps: 0, minLapUsage: 0, maxLapUsage: 0, lapsWithFuel: 0,
                lapsRemaining: 0, totalLaps: 0, fuelToFinish: 0, fuelToAdd: 0,
                canFinish: false, targetConsumption: 0, confidence: 'low' as const,
                pitWindowOpen: 0, pitWindowClose: 0, currentLap: 0, fuelAtFinish: 0,
                avgLapTime: 0, targetScenarios: undefined, projectedLapUsage: 0,
            };
        }

        // We use frozenFuelData.fuelLevel effectively
        // The logic below mirrors displayData but doesn't override with live currentFuelLevel
        const level = frozenFuelData.fuelLevel;
        const avgFuelPerLap = frozenFuelData.avg3Laps || frozenFuelData.lastLapUsage;
        const lapsWithFuel = avgFuelPerLap > 0 ? level / avgFuelPerLap : 0;
        const fuelAtFinish = level - frozenFuelData.lapsRemaining * avgFuelPerLap;

        // We don't really need accurate scenarios for the grid, but let's keep shape consistent
        return {
            ...frozenFuelData,
            fuelLevel: level,
            lapsWithFuel,
            pitWindowClose: frozenFuelData.currentLap + lapsWithFuel - 1,
            fuelAtFinish,
            targetScenarios: []
        };
    }, [frozenFuelData]);

    if (!editMode && settings?.showOnlyWhenOnTrack && !isOnTrack) return null;
    if (!editMode && !isSessionVisible) return <></>;

    const renderWidget = (widgetId: string) => {
        switch (widgetId) {
            case 'fuel2Header':
            case 'modernHeader':
                return <FuelCalculator2Header key={widgetId} widgetId={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2Gauge':
            case 'modernGauge':
                return <FuelCalculator2Gauge key={widgetId} widgetId={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2Grid':
            case 'modernGrid':
                // Use frozen data for grid (static rows) but pass throttled predictive usage for CURR row
                return <FuelCalculator2ConsumptionGrid
                    key={widgetId}
                    widgetId={widgetId}
                    fuelData={frozenFuelData}
                    liveFuelData={fuelData}
                    predictiveUsage={predictiveUsage}
                    displayData={frozenDisplayData}
                    fuelUnits={fuelUnits}
                    settings={settings}
                />;
            case 'fuel2Scenarios':
            case 'modernScenarios':
                return <FuelCalculator2PitScenarios key={widgetId} widgetId={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2TimeEmpty':
            case 'modernTimeEmpty':
                return <FuelCalculator2TimeEmpty key={widgetId} widgetId={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2Graph':
            case 'historyGraph':
                return <FuelCalculator2HistoryGraph key={widgetId} widgetId={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2TargetMessage':
                return <FuelCalculator2TargetMessage key={widgetId} widgetId={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
            case 'fuel2Confidence':
                return <FuelCalculator2Confidence key={widgetId} widgetId={widgetId} fuelData={fuelData} displayData={displayData} fuelUnits={fuelUnits} settings={settings} />;
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
                    borderColor: displayData.fuelStatus === 'safe' ? '#22c55e' :
                        displayData.fuelStatus === 'caution' ? '#f97316' : '#ef4444',
                    boxShadow: displayData.fuelStatus === 'safe' ? '0 0 15px rgba(34, 197, 94, 0.3) inset' :
                        displayData.fuelStatus === 'caution' ? '0 0 15px rgba(249, 115, 22, 0.3) inset' :
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
