import React from 'react';
import type { FuelCalculatorSettings, FuelCalculation } from '../types';

interface FuelCalculatorWidgetProps {
  fuelData: FuelCalculation | null;
  fuelUnits: 'L' | 'gal';
  settings?: FuelCalculatorSettings;
  widgetId?: string;
  displayData?: FuelCalculation;
  customStyles?: {
    fontSize?: number;
    labelFontSize?: number;
    valueFontSize?: number;
    barFontSize?: number;
  };
  compactMode?: 'off' | 'compact' | 'ultra';
}

export const FuelCalculatorHeader: React.FC<FuelCalculatorWidgetProps> = ({
  fuelData,
  settings,
  widgetId,
  customStyles,
  compactMode = 'off',
}) => {
  // Custom style handling for separate label/value sizes
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
      : '14px';

  if (!fuelData) return null;

  const stopsRemaining = fuelData.stopsRemaining ?? 0;
  const pitWindowOpen = fuelData.pitWindowOpen;

  // Confidence logic (mapping from existing data)
  const confidence = fuelData.confidence || 'low';
  let lapsText = `${Math.ceil(fuelData.lapsRemaining)}`;
  if (confidence === 'medium')
    lapsText = `~${Math.ceil(fuelData.lapsRemaining)}`;
  if (confidence === 'low' || confidence === 'very-low')
    lapsText = `${Math.floor(fuelData.lapsRemaining)}–${Math.ceil(fuelData.lapsRemaining + 2)}`;

  // If no data (avgLaps is 0), show --
  if ((fuelData.avgLaps || 0) <= 0) {
    lapsText = '--';
  }

  const paddingClass =
    compactMode === 'ultra' ? '' : compactMode === 'compact' ? 'p-1' : 'p-2';

  return (
    <div
      className={`border-b border-slate-600/50 ${paddingClass} ${compactMode !== 'off' ? 'mb-0' : 'mb-1'}`}
    >
      <div className="grid grid-cols-3">
        <div>
          <div
            className="font-semibold tracking-wide text-slate-500 uppercase"
            style={{ fontSize: labelFontSize }}
          >
            To go
          </div>
          <div
            className="font-bold text-white tabular-nums"
            style={{ fontSize: valueFontSize }}
            title={`${confidence} confidence`}
          >
            {lapsText}
          </div>
        </div>
        <div>
          <div
            className="text-slate-500 font-semibold tracking-wide uppercase"
            style={{ fontSize: labelFontSize }}
          >
            Next pit
          </div>
          <div
            className="text-white font-bold tabular-nums"
            style={{ fontSize: valueFontSize }}
          >
            L{pitWindowOpen}
          </div>
        </div>
        <div>
          <div
            className="text-slate-500 font-semibold tracking-wide uppercase"
            style={{ fontSize: labelFontSize }}
          >
            Stops
          </div>
          <div
            className="text-white font-bold tabular-nums"
            style={{ fontSize: valueFontSize }}
          >
            {stopsRemaining}
          </div>
        </div>
      </div>
    </div>
  );
};
