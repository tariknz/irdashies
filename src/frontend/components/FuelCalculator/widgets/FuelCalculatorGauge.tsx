import React from 'react';
import { formatFuel } from '../fuelCalculations';
import type { FuelCalculation, FuelCalculatorSettings } from '../types';

interface FuelCalculatorWidgetProps {
  fuelData: FuelCalculation | null;
  displayData: FuelCalculation;
  fuelUnits: 'L' | 'gal';
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

export const getFuelStatusColors = (
  status: 'safe' | 'caution' | 'danger' = 'safe'
) => {
  switch (status) {
    case 'safe':
      return {
        text: 'text-green-400',
        bar: 'from-green-500 to-green-400',
        border: 'border-green-500/50',
        bg: 'bg-green-500/10',
        borderSolid: 'border-green-500/50',
      };
    case 'caution':
      return {
        text: 'text-amber-400',
        bar: 'from-amber-500 to-amber-400',
        border: 'border-amber-500/50',
        bg: 'bg-amber-500/10',
        borderSolid: 'border-amber-500/50',
      };
    case 'danger':
      return {
        text: 'text-red-400',
        bar: 'from-red-500 to-red-400',
        border: 'border-red-500/50',
        bg: 'bg-red-500/10',
        borderSolid: 'border-red-500/50',
      };
    default:
      return {
        text: 'text-green-400',
        bar: 'from-green-500 to-green-400',
        border: 'border-green-500/50',
        bg: 'bg-green-500/10',
        borderSolid: 'border-green-500/50',
      };
  }
};

export const FuelCalculatorGauge: React.FC<FuelCalculatorWidgetProps> = ({
  fuelData,
  displayData,
  fuelUnits,
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
      : '18px';

  if (!fuelData) return null;

  const currentFuel = displayData.fuelLevel;
  const tankCapacity = fuelData.fuelTankCapacity ?? 60;
  const fuelPct = Math.min(
    100,
    Math.max(0, (currentFuel / tankCapacity) * 100)
  );

  const status = fuelData.fuelStatus || 'safe';
  const statusColors = getFuelStatusColors(status);
  const gradient = statusColors.bar;

  const fuelString = formatFuel(currentFuel, fuelUnits, 1);
  const lapsString = displayData.lapsWithFuel.toFixed(1);
  const tankString = formatFuel(tankCapacity, fuelUnits, 0);

  const paddingClass =
    compactMode === 'ultra'
      ? ''
      : compactMode === 'compact'
        ? 'px-1 pt-1 pb-0'
        : 'px-2 pt-2 pb-0';

  return (
    <div className={`${paddingClass} mb-1`}>
      <div
        className={`flex justify-between text-[0.75em] text-slate-400 font-medium items-end ${compactMode !== 'off' ? 'mb-0.5' : 'mb-1'}`}
      >
        <span
          className="uppercase tracking-wide"
          style={{ fontSize: labelFontSize }}
        >
          Tank
        </span>
        <span
          className="text-white font-bold tracking-wide"
          style={{ fontSize: valueFontSize }}
        >
          {fuelString} <span className="text-slate-500 font-medium">·</span>{' '}
          {lapsString} laps in tank
        </span>
        <span
          className="uppercase tracking-wide"
          style={{ fontSize: labelFontSize }}
        >
          {tankString} cap
        </span>
      </div>
      <div className="h-1.5 bg-slate-700/80 rounded-sm overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${gradient} transition-all duration-300`}
          style={{ width: `${fuelPct}%` }}
        />
      </div>
    </div>
  );
};
