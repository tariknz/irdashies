import { useState, useRef, useEffect } from 'react';
import type { FuelCalculation, FuelCalculatorSettings } from '../types';

interface FuelCalculatorWidgetProps {
    fuelData: FuelCalculation | null;
    displayData: any;
    fuelUnits?: 'L' | 'gal';
    settings?: FuelCalculatorSettings;
    widgetId?: string;
    customStyles?: { fontSize?: number; labelFontSize?: number; valueFontSize?: number; barFontSize?: number };
    isCompact?: boolean;
}

export const FuelCalculatorEconomyPredict: React.FC<FuelCalculatorWidgetProps> = ({ fuelData, displayData, settings, widgetId, customStyles, isCompact }) => {
    // Custom style handling for separate label/value sizes
    const widgetStyle = customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    // Use slightly larger default value font size for readability
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '12px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize * 1.2}px` : '14px');

    // Buffering Logic for "End of Lap" mode
    // We store the scenarios AND the lap number they belong to.
    const [bufferedState, setBufferedState] = useState<{ lap: number, scenarios: any[] } | null>(null);

    const currentLap = fuelData?.currentLap;

    useEffect(() => {
        // Guard against missing data
        if (currentLap === undefined || !displayData?.targetScenarios) return;

        // Update buffer ONLY if:
        // 1. No buffer exists
        // 2. Buffer is for an older lap (or different lap)
        // This effectively freezes the data for the duration of 'currentLap'
        setBufferedState(prev => {
            // Strict check: Only update if the lap has ACTUALLY changed from what we have buffered
            if (!prev || prev.lap !== currentLap) {
                try {
                    return {
                        lap: currentLap,
                        scenarios: JSON.parse(JSON.stringify(displayData.targetScenarios))
                    };
                } catch (e) {
                    console.error("Failed to clone scenarios", e);
                    return prev;
                }
            }
            return prev;
        });
    }, [currentLap]); // Dependent ONLY on currentLap changing.

    // Determine which data to show
    const mode = settings?.economyPredictMode ?? 'live';

    let scenariosToShow: any[] = [];
    if (mode === 'live') {
        scenariosToShow = displayData?.targetScenarios || [];
    } else {
        // Use buffer, fallback to live if empty or matching current lap is not yet ready (edge case)
        scenariosToShow = bufferedState?.scenarios || displayData?.targetScenarios || [];
    }

    // console.log('[EconomyPredict] Render', { mode, currentLap: fuelData?.currentLap, bufferLen: bufferedScenarios.length, showLen: scenariosToShow.length });

    if (!fuelData || !scenariosToShow || scenariosToShow.length === 0) {
        return (
            <div className={`flex items-center justify-center w-full rounded bg-slate-900/40 text-slate-500 italic`} style={{ fontSize: labelFontSize, minHeight: '30px' }}>
                Needs Fuel Data
            </div>
        );
    }

    return (
        <div className={`flex flex-row items-center justify-around w-full ${isCompact ? 'gap-0.5' : 'gap-2'}`}>
            {scenariosToShow.map((scenario: any) => {
                const isCurrent = scenario.isCurrentTarget;
                const lapsRemaining = scenario.laps;
                const absoluteTargetLap = displayData.currentLap + lapsRemaining;
                const fuelPerLap = scenario.fuelPerLap.toFixed(2);

                // Highlight current target
                const textColor = isCurrent ? 'text-green-400' : 'text-slate-300';
                const valueColor = isCurrent ? 'text-green-400 font-bold' : 'text-slate-200';
                const bgColor = isCurrent ? 'bg-green-500/10' : 'bg-transparent';

                return (
                    <div key={lapsRemaining} className={`flex flex-col items-center justify-center rounded px-2 ${bgColor} ${isCompact ? 'py-0.5' : 'py-1'}`}>
                        <span className={`${textColor} uppercase leading-none`} style={{ fontSize: labelFontSize }}>
                            L{absoluteTargetLap}
                        </span>
                        <span className={`${valueColor} leading-none mt-0.5`} style={{ fontSize: valueFontSize }}>
                            {fuelPerLap} <span className="text-[0.7em] text-slate-500">{settings?.fuelUnits || 'L'}/lap</span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
