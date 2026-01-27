import React from 'react';
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

    if (!fuelData || !displayData.targetScenarios || displayData.targetScenarios.length === 0) {
        return (
            <div className={`flex items-center justify-center w-full rounded bg-slate-900/40 text-slate-500 italic`} style={{ fontSize: labelFontSize, minHeight: '30px' }}>
                Needs Fuel Data
            </div>
        );
    }

    // Determine visibility based on settings (optional, but good practice)
    // We can add a showPredict setting later if needed, but for now we rely on widget presence in layout.

    return (
        <div className={`flex flex-row items-center justify-around w-full ${isCompact ? 'gap-0.5' : 'gap-2'}`}>
            {displayData.targetScenarios.map((scenario: any) => {
                const isCurrent = scenario.isCurrentTarget;
                const lapsRemaining = scenario.laps;
                const absoluteTargetLap = displayData.currentLap + lapsRemaining;
                const fuelPerLap = scenario.fuelPerLap.toFixed(2);

                // Styling based on user request logic could be added here if needed
                // Current logic: Just display the scenarios

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
