import React from 'react';
import type { FuelCalculation, FuelCalculatorSettings } from '../types';
import { useStore } from 'zustand';
import { useSessionStore, useTelemetryValue } from '@irdashies/context';

interface FuelCalculatorWidgetProps {
    fuelData: FuelCalculation | null;
    liveFuelData?: FuelCalculation | null;
    displayData: any;
    fuelUnits?: 'L' | 'gal';
    settings?: FuelCalculatorSettings;
    widgetId?: string;
    predictiveUsage?: number;
    customStyles?: { fontSize?: number; labelFontSize?: number; valueFontSize?: number; barFontSize?: number };
    isCompact?: boolean;
}

export const FuelCalculatorConsumptionGrid: React.FC<FuelCalculatorWidgetProps> = ({ fuelData, liveFuelData, predictiveUsage, displayData, settings, widgetId, customStyles, isCompact }) => {
    // Custom style handling for separate label/value sizes
    const widgetStyle = customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '10px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '12px');

    // Container style for other props like padding/margins if needed, but font size is handled per element now
    const containerStyle: React.CSSProperties = {
        ...((customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) as any) || {}),
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
    const avg = displayData.avgLaps || displayData.avg10Laps;
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

        // Refuel (Fuel to add)
        // Calculate based on "how much to add at the pit stop if I pit when empty"
        // This matches the logic in Pit Scenarios and is more consistent for strategy.
        const safetyMargin = settings?.safetyMargin ?? 0.05;
        const lapsPossible = usage > 0 ? fuelToUse / usage : 0;
        const conservativePitLapOffset = Math.floor(lapsPossible);
        const lapsAfterEmpty = Math.max(0, lapsRemainingToUse - conservativePitLapOffset);
        const toAdd = lapsAfterEmpty * usage * (1 + safetyMargin);

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
            refuel: toAdd > 0 ? toAdd.toFixed(2) : '--',
            finish: finish.toFixed(2)
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
        <div style={containerStyle} className={`grid grid-cols-5 ${isCompact ? 'gap-0 md:gap-x-0.5' : 'gap-0.5'} select-none overflow-hidden h-full content-start`}>
            {/* Grid Header */}
            <div className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`} style={{ fontSize: labelFontSize }}></div>
            <div className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`} style={{ fontSize: labelFontSize }}>USE</div>
            <div className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`} style={{ fontSize: labelFontSize }}>LAPS</div>
            <div className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`} style={{ fontSize: labelFontSize }}>REFUEL</div>
            <div className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`} style={{ fontSize: labelFontSize }}>AT FINISH</div>

            {/* Spacer for header bottom margin if needed (or handle via border/padding in cells) */}

            {/* Dynamic Rows based on Order */}
            {(() => {
                const defaultOrder = ['curr', 'avg', 'max', 'last', 'min'];
                const order = settings?.consumptionGridOrder || defaultOrder;
                const rowPadding = isCompact ? 'py-0' : 'py-0.5';

                const renderRow = (type: string) => {
                    switch (type) {
                        case 'curr':
                            if (!showCurrent) return null;
                            return (
                                <React.Fragment key="curr">
                                    <div className={`text-slate-400 ${rowPadding}`} style={{ fontSize: labelFontSize }}>CURR</div>
                                    <div className={`text-white text-center ${rowPadding} font-bold`} style={{ fontSize: valueFontSize }}>{currentUsage > 0 ? currentUsage.toFixed(2) : '--'}</div>
                                    <div className={`text-white text-center ${rowPadding} opacity-90`} style={{ fontSize: valueFontSize }}>{currentData.laps}</div>
                                    <div className={`${refuelColor} text-center ${rowPadding} opacity-90`} style={{ fontSize: valueFontSize }}>{currentData.refuel}</div>
                                    <div className={`${finishColor(currentData.finish)} text-center ${rowPadding} opacity-90`} style={{ fontSize: valueFontSize }}>{currentData.finish}</div>
                                </React.Fragment>
                            );
                        case 'avg':
                            if (!showAvg) return null;
                            const avgLabel = `AVG ${settings?.avgLapsCount || 3}`;
                            return (
                                <React.Fragment key="avg">
                                    <div className={`text-slate-400 ${rowPadding}`} style={{ fontSize: labelFontSize }}>{avgLabel}</div>
                                    <div className={`text-white text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{avg.toFixed(2)}</div>
                                    <div className={`text-white text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{avgData.laps}</div>
                                    <div className={`${refuelColor} text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{avgData.refuel}</div>
                                    <div className={`${finishColor(avgData.finish)} text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{avgData.finish}</div>
                                </React.Fragment>
                            );
                        case 'max':
                            if (!showMax) return null;
                            return (
                                <React.Fragment key="max">
                                    <div className={`text-slate-400 ${rowPadding}`} style={{ fontSize: labelFontSize }}>MAX</div>
                                    <div className={`text-orange-400 text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{max.toFixed(2)}</div>
                                    <div className={`text-white text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{maxData.laps}</div>
                                    <div className={`${refuelColor} text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{maxData.refuel}</div>
                                    <div className={`${finishColor(maxData.finish)} text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{maxData.finish}</div>
                                </React.Fragment>
                            );
                        case 'last':
                            if (!showLast) return null;
                            return (
                                <React.Fragment key="last">
                                    <div className={`text-slate-400 ${rowPadding}`} style={{ fontSize: labelFontSize }}>LAST</div>
                                    <div className={`text-white text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{last.toFixed(2)}</div>
                                    <div className={`text-white text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{lastData.laps}</div>
                                    <div className={`${refuelColor} text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{lastData.refuel}</div>
                                    <div className={`${finishColor(lastData.finish)} text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{lastData.finish}</div>
                                </React.Fragment>
                            );
                        case 'min':
                            if (!showMin) return null;
                            return (
                                <React.Fragment key="min">
                                    <div className={`text-slate-400 ${rowPadding}`} style={{ fontSize: labelFontSize }}>MIN</div>
                                    <div className={`text-green-400 text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{min.toFixed(2)}</div>
                                    <div className={`text-white text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{minData.laps}</div>
                                    <div className={`${refuelColor} text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{minData.refuel}</div>
                                    <div className={`${finishColor(minData.finish)} text-center ${rowPadding}`} style={{ fontSize: valueFontSize }}>{minData.finish}</div>
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
