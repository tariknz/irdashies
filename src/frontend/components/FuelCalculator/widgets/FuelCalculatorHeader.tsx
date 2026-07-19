import React from 'react';
import { GasPumpIcon } from '@phosphor-icons/react';
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

const getConfidenceConfig = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return { color: 'text-green-400', bg: 'bg-green-500', pulse: '' };
    case 'medium':
      return {
        color: 'text-amber-400',
        bg: 'bg-amber-500',
        pulse: 'animate-pulse',
      };
    case 'very-low':
    case 'low':
    default:
      return {
        color: 'text-red-400',
        bg: 'bg-red-500',
        pulse: 'animate-pulse',
      };
  }
};

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
  const confConfig = getConfidenceConfig(confidence);
  let lapsText = `${Math.ceil(fuelData.lapsRemaining)} LAPS`;
  if (confidence === 'medium')
    lapsText = `~${Math.ceil(fuelData.lapsRemaining)} LAPS`;
  if (confidence === 'low' || confidence === 'very-low')
    lapsText = `${Math.floor(fuelData.lapsRemaining)}-${Math.ceil(fuelData.lapsRemaining + 2)} LAPS`;

  // If no data (avgLaps is 0), show --
  if ((fuelData.avgLaps || 0) <= 0) {
    lapsText = '--';
  }

  const paddingClass =
    compactMode === 'ultra'
      ? ''
      : compactMode === 'compact'
        ? 'p-1'
        : 'px-2 py-1';

  return (
    <div className={paddingClass}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-x-3">
        <div>
          <div
            className="flex items-center gap-1 text-slate-500 font-semibold tracking-wide uppercase"
            style={{ fontSize: labelFontSize }}
          >
            <GasPumpIcon size={12} weight="fill" />
            <span>To go</span>
          </div>
          <div
            className={`flex items-center gap-1 ${confConfig.color} font-bold tabular-nums`}
            style={{ fontSize: valueFontSize }}
            title={`${confidence} confidence`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${confConfig.bg} ${confConfig.pulse}`}
            />
            {lapsText}
          </div>
        </div>
        <div className="flex items-baseline gap-1 whitespace-nowrap pb-px">
          <span
            className="text-slate-500 font-semibold tracking-wide uppercase"
            style={{ fontSize: labelFontSize }}
          >
            Next pit
          </span>
          <span
            className="text-white font-bold tabular-nums"
            style={{ fontSize: valueFontSize }}
          >
            L{pitWindowOpen}
          </span>
        </div>
        <div className="flex items-baseline gap-1 whitespace-nowrap pb-px">
          <span
            className="text-slate-500 font-semibold tracking-wide uppercase"
            style={{ fontSize: labelFontSize }}
          >
            Stops
          </span>
          <span
            className="text-white font-bold tabular-nums"
            style={{ fontSize: valueFontSize }}
          >
            {stopsRemaining}
          </span>
        </div>
      </div>
    </div>
  );
};
