import { memo } from 'react';
import { formatFuel } from '../fuelCalculations';
import type { FuelCalculatorWidgetProps } from '../types';

/* eslint-disable react/prop-types */

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

export const FuelCalculatorGauge = memo<FuelCalculatorWidgetProps>(
  ({
    fuelData,
    displayData,
    fuelUnits,
    settings,
    widgetId,
    customStyles,
    isCompact,
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

    if (!fuelData || !displayData) return null;

    const currentLevel = fuelData.fuelLevel || 0;
    const unit = fuelUnits || 'L';
    const tankCapacity = fuelData.fuelTankCapacity ?? 60;
    const fuelPct = Math.min(
      100,
      Math.max(0, (currentLevel / tankCapacity) * 100)
    );

    const status = fuelData.fuelStatus || 'safe';
    const colors = getFuelStatusColors(status);
    const gradient = colors.bar;
    const lapsWithFuel = displayData.lapsWithFuel;
    // const isDanger = lapsWithFuel < (settings?.dangerLapsThreshold || 1.5); // Removed as per instruction
    // const isCaution = lapsWithFuel < (settings?.cautionLapsThreshold || 3); // Removed as per instruction

    const levelStr = formatFuel(currentLevel, unit, 1);
    const lapsStr = lapsWithFuel.toFixed(1);

    return (
      <div className={isCompact ? 'mb-1' : 'mb-4'}>
        <div className="flex justify-between items-baseline mb-0.5">
          <span
            className="font-medium text-slate-400"
            style={{ fontSize: labelFontSize }}
          >
            FUEL
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="font-bold tabular-nums"
              style={{ fontSize: valueFontSize, color: colors.text }}
            >
              {levelStr}
            </span>
            <span className="text-slate-500 font-medium px-1">/</span>
            <span
              className="font-bold tabular-nums text-slate-300"
              style={{ fontSize: valueFontSize }}
            >
              {lapsStr}
              <span className="text-[0.6em] ml-0.5 opacity-70 uppercase">
                LAPS
              </span>
            </span>
          </div>
        </div>
        <div
          className={`h-2 bg-slate-700 rounded-full overflow-hidden shadow-inner`}
        >
          <div
            className={`h-full w-full origin-left transition-transform duration-1000 ease-out bg-linear-to-r will-change-transform ${gradient}`}
            style={{ transform: `scaleX(${fuelPct / 100}) translateZ(0)` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[0.6em] text-slate-500 font-bold uppercase tracking-wider">
          <span>EMPTY</span>
          <div className="flex gap-4">
            <div className="flex items-center gap-1">
              <span>FULL</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FuelCalculatorGauge.displayName = 'FuelCalculatorGauge';
