import React from 'react';
import type { FuelCalculation, FuelCalculatorSettings } from '../types';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very-low';

export interface FuelCalculatorWidgetProps {
  fuelData: FuelCalculation | null;
  displayData?: FuelCalculation | null;
  fuelUnits?: 'L' | 'gal';
  settings?: FuelCalculatorSettings;
  widgetId?: string;
  customStyles?: {
    fontSize?: number;
    labelFontSize?: number;
    valueFontSize?: number;
    barFontSize?: number;
  };
  compactMode?: 'off' | 'compact' | 'ultra';
}

export const FuelCalculatorConfidence: React.FC<FuelCalculatorWidgetProps> = ({
  fuelData,
  settings,
  widgetId,
  customStyles,
  compactMode,
}) => {
  if (!fuelData) return null;

  const confidence = fuelData.confidence || 'low';
  const lapsRange = fuelData.lapsRange || [0, 0];
  const fuelForLaps = lapsRange[1];

  // Custom style handling
  const widgetStyle =
    customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) || {};
  const labelFontSize = widgetStyle.labelFontSize
    ? `${widgetStyle.labelFontSize}px`
    : widgetStyle.fontSize
      ? `${widgetStyle.fontSize}px`
      : '10px';
  const valueFontSize = widgetStyle.valueFontSize
    ? `${widgetStyle.valueFontSize}px`
    : widgetStyle.fontSize
      ? `${widgetStyle.fontSize}px`
      : '12px';

  const paddingPart =
    compactMode === 'ultra' ? '' : compactMode === 'compact' ? 'p-1' : 'p-2';
  const containerPadding = `${paddingPart} ${compactMode !== 'off' ? 'mb-0.5' : 'mb-2'}`;

  if (confidence === 'low' || confidence === 'very-low') {
    return (
      <div
        className={`${containerPadding} bg-red-500/10 border border-red-500/30 rounded`}
      >
        <div
          className={`text-center ${paddingPart}`}
          style={{ fontSize: labelFontSize }}
        >
          <span className="text-red-400">
            {confidence === 'very-low'
              ? '⚠ Not enough data'
              : '⚠ Low confidence'}
          </span>
        </div>
        <div
          className={`text-center ${paddingPart} mt-0.5`}
          style={{ fontSize: valueFontSize }}
        >
          <span className="text-slate-400">
            Fuelling for{' '}
            <span className="text-white font-medium">{fuelForLaps}</span> laps
            (worst case)
          </span>
        </div>
      </div>
    );
  }

  if (confidence === 'medium') {
    return (
      <div
        className={`${containerPadding} bg-amber-500/10 border border-amber-500/30 rounded`}
      >
        <div className="text-center" style={{ fontSize: valueFontSize }}>
          <span className="text-slate-400">
            Fuelling for{' '}
            <span className="text-white font-medium">{fuelForLaps}</span> laps
            (worst case){' '}
            <span className="text-amber-400">⚠ Lap count uncertain</span>
          </span>
        </div>
      </div>
    );
  }

  // High confidence
  return (
    <div
      className={`${containerPadding} bg-green-500/5 border border-green-500/20 rounded`}
    >
      <div className="text-center" style={{ fontSize: valueFontSize }}>
        <span className="text-slate-400">
          Fuelling for{' '}
          <span className="text-white font-medium">{fuelForLaps}</span> laps
          (worst case)
        </span>
      </div>
    </div>
  );
};
