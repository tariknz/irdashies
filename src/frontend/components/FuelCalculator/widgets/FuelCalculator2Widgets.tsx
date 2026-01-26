import React, { useMemo } from 'react';
import { formatFuel } from '../fuelCalculations';
import type { FuelCalculation, FuelCalculatorSettings } from '../types';
import { useFuelStore } from '../FuelStore';
import { useDashboard, useSessionStore, useTelemetryValue, useSessionType } from '@irdashies/context';
import { ConsumptionGraphWidget } from './ConsumptionGraphWidget';
import { useStore } from 'zustand';

interface FuelCalculator2WidgetProps {
    fuelData: FuelCalculation | null;
    liveFuelData?: FuelCalculation | null; // Added for live updates in grid
    displayData: any; // Using the displayData from FuelCalculator which has some derived fields
    fuelUnits: 'L' | 'gal';
    settings?: FuelCalculatorSettings;
    widgetId?: string;
    predictiveUsage?: number;
}

// Map confidence to colors and text
const getConfidenceConfig = (confidence: string) => {
    switch (confidence) {
        case 'high':
            return {
                color: 'text-green-400',
                bg: 'bg-green-500',
                border: 'border-green-500',
                shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.3)]',
                pulse: ''
            };
        case 'medium':
            return {
                color: 'text-amber-400',
                bg: 'bg-amber-500',
                border: 'border-orange-500', // Mockup uses orange for medium? check css. .status-orange
                shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.3)]',
                pulse: 'animate-pulse'
            };
        case 'low': // using red for low
        default:
            return {
                color: 'text-red-400',
                bg: 'bg-red-500',
                border: 'border-red-500',
                shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
                pulse: 'animate-pulse'
            };
    }
};

const useWidgetStyles = (settings?: FuelCalculatorSettings, widgetId?: string) => {
    return useMemo(() => {
        if (!settings?.widgetStyles || !widgetId) return {};
        const styles = settings.widgetStyles[widgetId];
        if (!styles) return {};

        return {
            fontSize: styles.fontSize ? `${styles.fontSize}px` : undefined,
        };
    }, [settings, widgetId]);
};

export const FuelCalculator2Header: React.FC<FuelCalculator2WidgetProps> = ({ fuelData, fuelUnits, settings, widgetId }) => {
    // Custom style handling for separate label/value sizes
    const widgetStyle = (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '10px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '14px');

    if (!fuelData) return null;

    const stopsRemaining = fuelData.stopsRemaining ?? 0;
    const pitWindowOpen = fuelData.pitWindowOpen;

    // Confidence logic (mapping from existing data)
    const confidence = fuelData.confidence || 'low';
    const confConfig = getConfidenceConfig(confidence);

    // Format laps remaining for confidence pill
    let lapsText = `${Math.ceil(fuelData.lapsRemaining)} LAPS`;
    if (confidence === 'medium') lapsText = `~${Math.ceil(fuelData.lapsRemaining)} LAPS`;
    if (confidence === 'low') lapsText = `${Math.floor(fuelData.lapsRemaining)}-${Math.ceil(fuelData.lapsRemaining + 2)} LAPS`;

    return (
        <div className="flex items-center justify-between mb-1 pb-2 border-b border-slate-600/50">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-semibold tracking-wider" style={{ fontSize: labelFontSize }}>STOPS</span>
                    <span className="text-white font-bold" style={{ fontSize: valueFontSize }}>{stopsRemaining}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-semibold tracking-wider" style={{ fontSize: labelFontSize }}>EARLIEST</span>
                    <span className="text-green-400 font-bold" style={{ fontSize: valueFontSize }}>L{pitWindowOpen}</span>
                </div>
            </div>
            <div className="flex items-center">
                <div className="flex items-center gap-2" title={`${confidence} confidence`}>
                    <div className={`w-2 h-2 rounded-full ${confConfig.bg} ${confConfig.pulse}`}></div>
                    <span className={`${confConfig.color} font-bold`} style={{ fontSize: valueFontSize }}>{lapsText}</span>
                </div>
            </div>
        </div>
    );
};

export const FuelCalculator2Gauge: React.FC<FuelCalculator2WidgetProps> = ({ fuelData, displayData, fuelUnits, settings, widgetId }) => {
    // Custom style handling for separate label/value sizes
    const widgetStyle = (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '10px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '18px');

    if (!fuelData) return null;

    const currentFuel = displayData.fuelLevel;
    const tankCapacity = fuelData.fuelTankCapacity ?? 60;
    const fuelPct = Math.min(100, Math.max(0, (currentFuel / tankCapacity) * 100));

    // Color based on level (optional, mockup uses green gradient mostly, or amber/red if low confidence/fuel?)
    // Mockup uses specific gradients per status. Let's stick to green for now or dynamic.
    // Actually mockup couples border color to status. Gauge seems to follow too.
    const confidence = fuelData.confidence || 'low';
    let gradient = 'from-green-500 to-green-400';
    if (confidence === 'medium') gradient = 'from-amber-500 to-amber-400';
    if (confidence === 'low') gradient = 'from-red-500 to-red-400';

    const fuelString = formatFuel(currentFuel, fuelUnits, 1);
    const lapsString = displayData.lapsWithFuel.toFixed(1);
    const tankString = formatFuel(tankCapacity, fuelUnits, 0);

    return (
        <div className="mb-4">
            <div className="flex justify-between text-[0.75em] text-slate-400 mb-2 font-medium items-end">
                <span className="mb-0.5" style={{ fontSize: labelFontSize }}>E</span>
                <span className="text-white font-bold tracking-wide" style={{ fontSize: valueFontSize }}>
                    {fuelString} / {lapsString} laps
                </span>
                <span className="mb-0.5" style={{ fontSize: labelFontSize }}>{tankString}</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden shadow-inner border border-slate-600/50">
                <div
                    className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-500 relative`}
                    style={{ width: `${fuelPct}%` }}
                >
                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                    <div className="absolute top-0 bottom-0 right-0 left-0 bg-gradient-to-b from-white/10 to-transparent"></div>
                </div>
            </div>
        </div>
    );
};

export const FuelCalculator2ConsumptionGrid: React.FC<FuelCalculator2WidgetProps> = ({ fuelData, liveFuelData, predictiveUsage, displayData, settings, widgetId }) => {
    // Custom style handling for separate label/value sizes
    const widgetStyle = (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '10px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '12px');

    // Container style for other props like padding/margins if needed, but font size is handled per element now
    const containerStyle: React.CSSProperties = {
        ...(((widgetId && settings?.widgetStyles?.[widgetId]) as any) || {}),
        fontSize: undefined // Don't set parent font size to avoid inheritance issues
    };
    if (!fuelData) return null;

    // Master visibility toggle
    if (settings && settings.showConsumption === false) return null;

    // Visibility Settings (Default to true if no settings provided, except Min which is optional in modern default layout)
    const showAvg = settings ? (settings.show3LapAvg || settings.show10LapAvg) : true;
    const showMax = settings ? settings.showMax : true;
    const showLast = settings ? settings.showLastLap : true;
    const showCurrent = settings ? settings.showCurrentLap : true;
    const showMin = settings ? settings.showMin : false; // Default off for compact modern layout unless enabled

    // Grid Data
    const avg = displayData.avg10Laps || displayData.avg3Laps;
    const max = displayData.maxLapUsage;
    const last = displayData.lastLapUsage;
    // Add min data
    const min = displayData.minLapUsage || 0;

    // Predictive Data (throttled)
    // Use prop if available, fallback to live data projected (jittery), fallback to 0
    const currentUsage = predictiveUsage ?? liveFuelData?.projectedLapUsage ?? 0;

    // Check if we are in a testing/practice session
    // We need the current SessionNum to look up the SessionType in the SessionInfo array
    const sessionNum = useTelemetryValue('SessionNum');
    const sessionType = useStore(useSessionStore, (state) =>
        state.session?.SessionInfo?.Sessions?.find((s) => s.SessionNum === sessionNum)?.SessionType
    );

    // Check for "Offline Testing" or "Practice"
    const isTesting = sessionType === 'Offline Testing' || sessionType === 'Practice';

    // Calculate derivates (Laps, Refuel, Finish) for each column
    // This duplicates some logic but ensures consistent display as per mockup
    const calcCol = (usage: number, isCurrentRow = false) => {
        if (usage <= 0) return { laps: '--', refuel: '--', finish: '--' };

        // For Current Row, we should use LIVE fuel level for better prediction if possible?
        // But to keep it comparable to other rows within the same 'snapshot' context, using frozen fuel level from displayData is safer for relative comparison.
        // HOWEVER, "Predictive" usually means "Current State". 
        // Let's use displayData.fuelLevel (which is frozen) to see "If I continue at this rate with the fuel I STARTED the lap with..." 
        // OR better: "With the fuel I have RIGHT NOW".
        // The displayData passed to this component is FROZEN.
        // liveFuelData has 'fuelLevel' which is live.

        const fuelToUse = displayData.fuelLevel;
        const lapsRemainingToUse = fuelData.lapsRemaining;

        // Laps calculation
        const laps = fuelToUse / usage;

        // Finish (Fuel at finish)
        const fuelNeeded = lapsRemainingToUse * usage;
        const finish = fuelToUse - fuelNeeded;

        // Refuel (Fuel to add) - simplified logic for display
        const toAdd = Math.max(0, fuelNeeded - fuelToUse);

        // If testing, hide Refuel and Finish
        if (isTesting) {
            return {
                laps: laps.toFixed(2),
                refuel: '--',
                finish: '--'
            };
        }

        return {
            laps: isFinite(laps) ? laps.toFixed(2) : '--',
            refuel: toAdd > 0 ? toAdd.toFixed(2) : '--', // Mockup shows values, we show -- if 0? or 0. Mockup has Refuel col.
            finish: finish.toFixed(2) // Positive or negative
        };
    };

    const avgData = calcCol(avg);
    const maxData = calcCol(max);
    const lastData = calcCol(last);
    const minData = calcCol(min);

    // Calculate Current Row Data
    const currentData = calcCol(currentUsage, true);

    // Helper for color coding Finish
    const finishColor = (val: string) => {
        if (val === '--') return 'text-slate-500';
        const num = parseFloat(val);
        return num >= 0 ? 'text-green-400' : 'text-orange-400'; // Positive is green (extra fuel), negative is orange (missing)
    };

    // Helper for Refuel color
    const refuelColor = 'text-cyan-400'; // Mockup uses cyan for refuel

    return (
        <div style={containerStyle} className="grid grid-cols-5 gap-0.5 select-none overflow-hidden h-full content-start">
            {/* Grid Header */}
            <div className="text-center font-bold text-slate-400 border-b border-slate-600/50 pb-1 mb-1" style={{ fontSize: labelFontSize }}></div>
            <div className="text-center font-bold text-slate-400 border-b border-slate-600/50 pb-1 mb-1" style={{ fontSize: labelFontSize }}>USE</div>
            <div className="text-center font-bold text-slate-400 border-b border-slate-600/50 pb-1 mb-1" style={{ fontSize: labelFontSize }}>LAPS</div>
            <div className="text-center font-bold text-slate-400 border-b border-slate-600/50 pb-1 mb-1" style={{ fontSize: labelFontSize }}>REFUEL</div>
            <div className="text-center font-bold text-slate-400 border-b border-slate-600/50 pb-1 mb-1" style={{ fontSize: labelFontSize }}>FINISH</div>

            {/* Spacer for header bottom margin if needed (or handle via border/padding in cells) */}

            {/* Dynamic Rows based on Order */}
            {(() => {
                const defaultOrder = ['curr', 'avg', 'max', 'last', 'min'];
                const order = settings?.consumptionGridOrder || defaultOrder;

                const renderRow = (type: string) => {
                    switch (type) {
                        case 'curr':
                            if (!showCurrent) return null;
                            return (
                                <React.Fragment key="curr">
                                    <div className="text-slate-400 py-0.5" style={{ fontSize: labelFontSize }}>CURR</div>
                                    <div className="text-white text-center py-0.5 font-bold" style={{ fontSize: valueFontSize }}>{currentUsage > 0 ? currentUsage.toFixed(2) : '--'}</div>
                                    <div className="text-white text-center py-0.5 opacity-90" style={{ fontSize: valueFontSize }}>{currentData.laps}</div>
                                    <div className={`${refuelColor} text-center py-0.5 opacity-90`} style={{ fontSize: valueFontSize }}>{currentData.refuel}</div>
                                    <div className={`${finishColor(currentData.finish)} text-center py-0.5 opacity-90`} style={{ fontSize: valueFontSize }}>{currentData.finish}</div>
                                </React.Fragment>
                            );
                        case 'avg':
                            if (!showAvg) return null;
                            return (
                                <React.Fragment key="avg">
                                    <div className="text-slate-400 py-0.5" style={{ fontSize: labelFontSize }}>AVG</div>
                                    <div className="text-white text-center py-0.5" style={{ fontSize: valueFontSize }}>{avg.toFixed(2)}</div>
                                    <div className="text-white text-center py-0.5" style={{ fontSize: valueFontSize }}>{avgData.laps}</div>
                                    <div className={`${refuelColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{avgData.refuel}</div>
                                    <div className={`${finishColor(avgData.finish)} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{avgData.finish}</div>
                                </React.Fragment>
                            );
                        case 'max':
                            if (!showMax) return null;
                            return (
                                <React.Fragment key="max">
                                    <div className="text-slate-400 py-0.5" style={{ fontSize: labelFontSize }}>MAX</div>
                                    <div className="text-orange-400 text-center py-0.5" style={{ fontSize: valueFontSize }}>{max.toFixed(2)}</div>
                                    <div className="text-white text-center py-0.5" style={{ fontSize: valueFontSize }}>{maxData.laps}</div>
                                    <div className={`${refuelColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{maxData.refuel}</div>
                                    <div className={`${finishColor(maxData.finish)} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{maxData.finish}</div>
                                </React.Fragment>
                            );
                        case 'last':
                            if (!showLast) return null;
                            return (
                                <React.Fragment key="last">
                                    <div className="text-slate-400 py-0.5" style={{ fontSize: labelFontSize }}>LAST</div>
                                    <div className="text-white text-center py-0.5" style={{ fontSize: valueFontSize }}>{last.toFixed(2)}</div>
                                    <div className="text-white text-center py-0.5" style={{ fontSize: valueFontSize }}>{lastData.laps}</div>
                                    <div className={`${refuelColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{lastData.refuel}</div>
                                    <div className={`${finishColor(lastData.finish)} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{lastData.finish}</div>
                                </React.Fragment>
                            );
                        case 'min':
                            if (!showMin) return null;
                            return (
                                <React.Fragment key="min">
                                    <div className="text-slate-400 py-0.5" style={{ fontSize: labelFontSize }}>MIN</div>
                                    <div className="text-green-400 text-center py-0.5" style={{ fontSize: valueFontSize }}>{min.toFixed(2)}</div>
                                    <div className="text-white text-center py-0.5" style={{ fontSize: valueFontSize }}>{minData.laps}</div>
                                    <div className={`${refuelColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{minData.refuel}</div>
                                    <div className={`${finishColor(minData.finish)} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{minData.finish}</div>
                                </React.Fragment>
                            );
                        default:
                            return null;
                    }
                };

                // Filter unique valid IDs to avoid duplicates if config is messed up
                const uniqueOrder = Array.from(new Set(order));
                return uniqueOrder.map(id => renderRow(id));
            })()}
        </div>
    );
};

export const FuelCalculator2PitScenarios: React.FC<FuelCalculator2WidgetProps> = ({ fuelData, displayData, settings, widgetId }) => {
    // Custom style handling for separate label/value sizes
    const widgetStyle = (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '10px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '12px');

    const sessionNum = useTelemetryValue('SessionNum');
    const sessionType = useSessionType(sessionNum);
    const isTesting = sessionType === 'Offline Testing';

    // Determine visibility based on settings (default true if missing)
    if (settings && settings.showFuelScenarios === false) return null;

    if (!fuelData || !displayData.targetScenarios || displayData.targetScenarios.length === 0) {
        // Show "Pit scenarios available after more laps" placeholder if empty
        return (
            <div>
                <div className="border-t border-slate-600/30 mb-2"></div>
                <div className="text-[0.75em] text-center text-slate-400 mb-3 py-2 bg-slate-900/40 rounded" style={{ fontSize: labelFontSize }}>
                    Pit scenarios available after more laps
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="border-t border-slate-600/30 mb-2"></div>

            <div className="grid grid-cols-4 gap-1 mb-3">
                <div className="text-slate-500 text-center" style={{ fontSize: labelFontSize }}>PIT @</div>
                <div className="text-slate-500 text-center" style={{ fontSize: labelFontSize }}>ADD</div>
                <div className="text-slate-500 text-center" style={{ fontSize: labelFontSize }}>FINISH</div>
                <div className="text-slate-500 text-center" style={{ fontSize: labelFontSize }}>WINDOW</div>

                {displayData.targetScenarios.map((scenario: any) => {
                    // Calculate values for this scenario
                    const fuelPerLap = scenario.fuelPerLap;
                    const lapsToCover = fuelData.lapsRemaining; // Rough estimate, technically depends on when we pit
                    const fuelNeeded = lapsToCover * fuelPerLap;
                    const toAdd = Math.max(0, fuelNeeded - displayData.fuelLevel);
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const finishBuffer = displayData.fuelLevel + toAdd - fuelNeeded; // Should be ~0 if we add exact

                    // NOTE: The calculation in mockup implies "Add" to reach a certain comfortable Finish buffer?
                    // Or just "Add" to finish? 
                    // In logic: fuelPerLap = fuelLevel / lapCount. 
                    // This means with CURRENT fuel we can do `lapCount` laps. 
                    // BUT the scenarios widget in mockup says "PIT @ L17, ADD +26.9".
                    // This implies: If I pit at Lap 17, I need to add 26.9L to finish.
                    // The backend `targetScenarios` currently returns `laps` (target laps with current fuel) and `fuelPerLap`.
                    // It does NOT calculate generalized Pit Strategies for different Pit Laps.
                    // EXISTING `targetScenarios` logic: "targetScenarios for making current fuel last different lap counts"
                    // MOCKUP logic: "Pit Scenario Rows" -> Pit at L17, L18, L19...

                    // Since I must use EXISTING data, I will adapt the display to what we have, OR try to approximate the Mockup's intent with `targetScenarios`.
                    // Existing `targetScenarios` gives us: "If you burn X L/lap, you last Y laps".
                    // This is NOT "If you pit at Y...".

                    // However, the visual requests "Pit @" column.
                    // Let's use the `laps` from targetScenario as the "Pit @" lap (assuming we pit when empty).
                    // Lap = currentLap + lapsRemainingWithFuel.
                    const pitLap = fuelData.currentLap + scenario.laps;

                    // Fuel to Add calculation:
                    // If we pit at `pitLap`, we have `lapsRemaining - scenario.laps` laps left in race.
                    // Fuel needed = (RemainingRaceLaps - lapsCoveredByCurrentTank) * avgConsumption ??
                    // Let's simplified: Fuel To Add = FuelToFinish - CurrentFuel. (Constant ideally).
                    // But if we pit LATER, we might burn less? No, consumption is constant.
                    // Maybe mockup implies: "If you pit at L17 (Early), you need to add X".
                    // versus "If you pit at L19 (Later), you need to add Y".
                    // Usually Fuel To Add is constant if consumption is constant.
                    // Difference is usually Safety Margin or risk.

                    // Let's stick to the visual format but maybe use available data.
                    // `scenario.laps` is "Laps with current fuel". So that IS the "Pit @" lap (latest).

                    // Color coding
                    let colorClass = 'text-cyan-400';
                    if (scenario.isCurrentTarget) colorClass = 'text-green-400 font-medium';

                    // Calculate hypothetical ADD
                    // If we drive `scenario.laps` laps, we arrive at pit.
                    // Laps left to finish = totalLaps - (currentLap + scenario.laps).
                    const lapsLeftAfterPit = Math.max(0, fuelData.totalLaps - pitLap);
                    const safetyMargin = settings?.safetyMargin ?? 0.05;
                    const fuelToAddHypothetical = lapsLeftAfterPit * (displayData.avg10Laps || 0) * (1 + safetyMargin);

                    // Calculate estimated fuel at finish: (Added) - (Needed for remaining laps)
                    // Since we arrive at pit empty (scenario assumption), Added is the total available.
                    const fuelBurnedToFinish = lapsLeftAfterPit * (displayData.avg10Laps || 0);
                    const estimatedFinishFuel = Math.max(0, fuelToAddHypothetical - fuelBurnedToFinish);

                    // Window Status Logic  
                    // Strategic Open = Earliest lap we can pit and reach the end on one tank.
                    // = TotalLaps - LapsPerStint (approx for 1-stop)
                    const lapsPerStintVal = fuelData.lapsPerStint || 0;
                    const hasValidStint = lapsPerStintVal > 0;

                    const strategicWindowOpen = Math.max(1, Math.floor(fuelData.totalLaps - lapsPerStintVal));
                    const windowClose = Math.floor(fuelData.currentLap + fuelData.lapsWithFuel);

                    let windowStatus = '';
                    if (!hasValidStint) {
                        windowStatus = '--';
                    } else if (pitLap >= strategicWindowOpen && pitLap <= windowClose) {
                        windowStatus = 'OK';
                    } else if (pitLap === strategicWindowOpen - 1) {
                        windowStatus = '+1';
                    } else if (pitLap < strategicWindowOpen) {
                        windowStatus = 'Early';
                    } else {
                        windowStatus = 'Late';
                    }

                    const addDisplay = isTesting ? '--' : `+${fuelToAddHypothetical.toFixed(1)}`;
                    const finishDisplay = isTesting ? '--' : estimatedFinishFuel.toFixed(1);
                    const windowDisplay = isTesting ? '--' : windowStatus;

                    // Row Color Logic determines the color for ALL text in the row
                    let rowColor = 'text-cyan-400'; // Default
                    if (windowStatus === 'OK') rowColor = 'text-green-400 font-bold';
                    else if (windowStatus === 'Early' || windowStatus === '+1' || windowStatus === 'Late') rowColor = 'text-yellow-400';

                    return (
                        <React.Fragment key={scenario.laps}>
                            <div className={`${rowColor} py-0.5 text-center`} style={{ fontSize: valueFontSize }}>L{pitLap}</div>
                            <div className={`${rowColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{addDisplay}</div>
                            <div className={`${rowColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{finishDisplay}</div>
                            <div className={`${rowColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{windowDisplay}</div>
                        </React.Fragment>
                    );
                })}

                {/* Optional 4th Row for Fixed Target */}
                {settings?.enableTargetPitLap && settings.targetPitLap && (
                    <TargetScenarioRow
                        targetLap={settings.targetPitLap}
                        fuelData={fuelData}
                        displayData={displayData}
                        settings={settings}
                        valueFontSize={valueFontSize}
                        isTesting={isTesting}
                    />
                )}
            </div>
        </div>
    );
};

// Helper component for the Target row to avoid duplication
const TargetScenarioRow: React.FC<{
    targetLap: number,
    fuelData: any,
    displayData: any,
    settings: any,
    valueFontSize: string,
    isTesting: boolean
}> = ({ targetLap, fuelData, displayData, settings, valueFontSize, isTesting }) => {
    const lapsLeftAfterPit = Math.max(0, fuelData.totalLaps - targetLap);
    const safetyMargin = settings?.safetyMargin ?? 0.05;
    const consumption = displayData.avg10Laps || 0;
    const fuelToAddHypothetical = lapsLeftAfterPit * consumption * (1 + safetyMargin);
    const fuelBurnedToFinish = lapsLeftAfterPit * consumption;
    const estimatedFinishFuel = Math.max(0, fuelToAddHypothetical - fuelBurnedToFinish);

    const addDisplay = (isTesting || consumption === 0) ? '--' : `+${fuelToAddHypothetical.toFixed(1)}`;
    const finishDisplay = (isTesting || consumption === 0) ? '--' : estimatedFinishFuel.toFixed(1);
    const rowColor = 'text-purple-400 font-bold bg-purple-500/20 rounded';

    return (
        <React.Fragment>
            <div className={`${rowColor} py-0.5 text-center`} style={{ fontSize: valueFontSize }}>L{targetLap}</div>
            <div className={`${rowColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{addDisplay}</div>
            <div className={`${rowColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>{finishDisplay}</div>
            <div className={`${rowColor} text-center py-0.5`} style={{ fontSize: valueFontSize }}>TARGET</div>
        </React.Fragment>
    );
};

export const FuelCalculator2TargetMessage: React.FC<FuelCalculator2WidgetProps> = ({ fuelData, displayData, settings, widgetId }) => {
    if (!settings?.enableTargetPitLap || !settings.targetPitLap || !fuelData) return null;

    const targetLap = settings.targetPitLap;
    const lapsLeftAfterPit = Math.max(0, fuelData.totalLaps - targetLap);
    const safetyMargin = settings?.safetyMargin ?? 0.05;
    const consumption = displayData.avg10Laps || 0;
    const fuelToAddHypothetical = lapsLeftAfterPit * consumption * (1 + safetyMargin);

    const widgetStyle = (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '10px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '16px');

    const isTesting = settings?.sessionVisibility?.offlineTesting;
    const needDisplay = (isTesting || consumption === 0) ? '--' : `+${fuelToAddHypothetical.toFixed(1)}L`;

    return (
        <div className="mb-2 py-1 px-2 bg-purple-500/20 border border-purple-500/50 rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-purple-400 font-medium" style={{ fontSize: labelFontSize }}>🎯 TARGET</span>
                <span className="text-white font-bold" style={{ fontSize: valueFontSize }}>L{targetLap}</span>
            </div>
            <div className="text-xs">
                <span className="text-slate-400" style={{ fontSize: labelFontSize }}>Need:</span>
                <span className="text-purple-300 font-medium ml-1" style={{ fontSize: valueFontSize }}>
                    {needDisplay}
                </span>
            </div>
        </div>
    );
};

export const FuelCalculator2TimeEmpty: React.FC<FuelCalculator2WidgetProps> = ({ fuelData, displayData, settings, widgetId }) => {
    // Custom style handling for separate label/value sizes
    const widgetStyle = (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '10px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '24px');

    if (!fuelData) return null;

    // Calculate time until empty
    // lapsWithFuel * avgLapTime
    const secondsLeft = displayData.lapsWithFuel * (fuelData.avgLapTime || 0);

    // Format to HH:MM:SS
    const formatTime = (secs: number) => {
        if (!secs || secs < 0) return "00:00:00";
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Confidence border color
    const confidence = fuelData.confidence || 'low';
    let borderColor = 'border-red-500/50';
    if (confidence === 'medium') borderColor = 'border-amber-500/50';
    if (confidence === 'high') borderColor = 'border-green-500/50';

    return (
        <div className={`bg-slate-900/80 rounded px-3 py-2 border ${borderColor}`}>
            <div className="flex items-center justify-between">
                <span className="text-slate-400 uppercase" style={{ fontSize: labelFontSize }}>Time Empty</span>
                <span className="font-mono font-bold text-white tracking-widest" style={{ fontSize: valueFontSize }}>
                    {formatTime(secondsLeft)}
                </span>
            </div>
        </div>
    );
};

export const FuelCalculator2HistoryGraph: React.FC<FuelCalculator2WidgetProps> = ({ settings, fuelUnits, widgetId }) => {
    const styles = useWidgetStyles(settings, widgetId);

    // Access store directly to be self-contained
    const lapHistory = useFuelStore((state) => state.lapHistory);
    const lastLap = useFuelStore((state) => state.lastLap);
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
            .filter((lap) => (!lap.isOutLap || lap.lapNumber >= 1) && lap.fuelUsed > 0)
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
    }, [lapHistory, lapHistory.size, lastLap, fuelHistoryType]);


    // Reuse the existing widget!
    if (settings && settings.showFuelHistory === false) return null;

    return (
        <div style={styles} className="mt-2 mb-1 w-full flex-1 min-h-[60px] flex flex-col">
            <ConsumptionGraphWidget
                graphData={isDemoMode ? null : graphData}
                consumptionGraphType={fuelHistoryType}
                fuelUnits={fuelUnits}
                showConsumptionGraph={true}
                editMode={false}
                manualTarget={settings?.manualTarget}
            />
        </div>
    );
};
