import React from 'react';
import { formatFuel } from '../fuelCalculations';
import type { FuelCalculation, FuelCalculatorSettings } from '../types';

interface FuelCalculatorFinishFuelProps {
  fuelData: FuelCalculation | null;
  displayData: FuelCalculation;
  fuelUnits?: 'L' | 'gal';
  settings?: FuelCalculatorSettings;
  widgetId?: string;
  customStyles?: {
    fontSize?: number;
    labelFontSize?: number;
    valueFontSize?: number;
  };
  compactMode?: 'off' | 'compact' | 'ultra';
}

export const FuelCalculatorFinishFuel: React.FC<
  FuelCalculatorFinishFuelProps
> = ({
  fuelData,
  displayData,
  fuelUnits = 'L',
  settings,
  widgetId,
  customStyles,
  compactMode,
}) => {
  if (!fuelData) return null;

  const widgetStyle =
    customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) || {};
  const labelFontSize = widgetStyle.labelFontSize
    ? `${widgetStyle.labelFontSize}px`
    : '10px';
  const valueFontSize = widgetStyle.valueFontSize
    ? `${widgetStyle.valueFontSize}px`
    : '14px';
  const balance = displayData.fuelAtFinish;
  const isShort = balance < 0;
  const value = formatFuel(Math.abs(balance), fuelUnits, 1);
  const padding =
    compactMode === 'ultra' ? '' : compactMode === 'compact' ? 'p-1' : 'p-2';

  return (
    <div
      className={`${padding} flex items-center justify-between border-t border-slate-600/30`}
    >
      <span
        className="font-semibold tracking-wide text-slate-400 uppercase"
        style={{ fontSize: labelFontSize }}
      >
        Fuel at end
      </span>
      <span
        className={`font-bold tabular-nums ${isShort ? 'text-red-400' : 'text-emerald-400'}`}
        style={{ fontSize: valueFontSize }}
      >
        {isShort ? `SHORT ${value}` : `+${value}`}
      </span>
    </div>
  );
};
