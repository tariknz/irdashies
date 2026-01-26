import React from 'react';
import type { FuelCalculatorSettings, FuelCalculation } from '../types';

interface FuelCalculatorWidgetProps {
    fuelData: FuelCalculation | null;
    fuelUnits: 'L' | 'gal';
    settings?: FuelCalculatorSettings;
    widgetId?: string;
    displayData?: any;
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
                border: 'border-orange-500',
                shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.3)]',
                pulse: 'animate-pulse'
            };
        case 'low':
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

export const FuelCalculatorHeader: React.FC<FuelCalculatorWidgetProps> = ({ fuelData, fuelUnits, settings, widgetId }) => {
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
