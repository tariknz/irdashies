import React from 'react';
import type { FuelCalculation, FuelCalculatorSettings } from '../types';

interface FuelCalculatorWidgetProps {
    fuelData: FuelCalculation | null;
    displayData: any;
    fuelUnits?: 'L' | 'gal';
    settings?: FuelCalculatorSettings;
    widgetId?: string;
}

export const FuelCalculatorTargetMessage: React.FC<FuelCalculatorWidgetProps> = ({ fuelData, displayData, settings, widgetId }) => {
    if (!settings?.enableTargetPitLap || !settings.targetPitLap || !fuelData) return null;

    const targetLap = settings.targetPitLap;
    const lapsLeftAfterPit = Math.max(0, fuelData.totalLaps - targetLap);
    const safetyMargin = settings?.safetyMargin ?? 0.05;
    const consumption = displayData.avg10Laps || 0;
    const fuelToAddHypothetical = lapsLeftAfterPit * consumption * (1 + safetyMargin);

    const widgetStyle = (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize ? `${widgetStyle.labelFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '10px');
    const valueFontSize = widgetStyle.valueFontSize ? `${widgetStyle.valueFontSize}px` : (widgetStyle.fontSize ? `${widgetStyle.fontSize}px` : '16px');

    const needDisplay = (consumption === 0) ? '--' : `+${fuelToAddHypothetical.toFixed(1)}L`;

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
