import { memo } from 'react';
import type { FuelCalculatorWidgetProps } from '../types';

/* eslint-disable react/prop-types */

// Map confidence to colors and text
const getConfidenceConfig = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return {
        color: 'text-green-400',
        bg: 'bg-green-500',
        border: 'border-green-500',
        shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.3)]',
        pulse: '',
      };
    case 'medium':
      return {
        color: 'text-amber-400',
        bg: 'bg-amber-500',
        border: 'border-orange-500',
        shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.3)]',
        pulse: 'animate-pulse',
      };
    case 'very-low':
    case 'low':
    default:
      return {
        color: 'text-red-400',
        bg: 'bg-red-500',
        border: 'border-red-500',
        shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
        pulse: 'animate-pulse',
      };
  }
};

export const FuelCalculatorHeader = memo<FuelCalculatorWidgetProps>(
  ({ fuelData, settings, widgetId, customStyles, isCompact }) => {
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

    // Format laps remaining for confidence pill
    let lapsText = `${Math.ceil(fuelData.lapsRemaining)} LAPS`;
    if (confidence === 'medium')
      lapsText = `~${Math.ceil(fuelData.lapsRemaining)} LAPS`;
    if (confidence === 'low' || confidence === 'very-low')
      lapsText = `${Math.floor(fuelData.lapsRemaining)}-${Math.ceil(fuelData.lapsRemaining + 2)} LAPS`;

    // If no data (avgLaps is 0), show --
    if ((fuelData.avgLaps || 0) <= 0) {
      lapsText = '--';
    }

    // Grid Warning Logic
    if (fuelData.gridWarning) {
      let warningMsg = '';
      let warningColor = 'text-red-400';
      let warningBg = 'bg-red-500/20';
      let warningBorder = 'border-red-500';

      switch (fuelData.gridWarning) {
        case 'fill_tank':
          warningMsg = 'INSUFFICIENT FUEL';
          break;
        case 'low_fuel':
          warningMsg = 'LOW FUEL (< 5 LAPS)';
          warningColor = 'text-amber-400';
          warningBg = 'bg-amber-500/20';
          warningBorder = 'border-amber-500';
          break;
        case 'can_finish_fill':
          warningMsg = 'FILL TANK RECOMMENDED';
          warningColor = 'text-blue-300';
          warningBg = 'bg-blue-500/20';
          warningBorder = 'border-blue-500';
          break;
      }

      return (
        <div
          className={`flex items-center justify-center ${isCompact ? 'mb-0 pb-0.5' : 'mb-1 pb-2 border-b border-slate-600/50'}`}
        >
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded w-full justify-center border ${warningBg} ${warningBorder}`}
          >
            <span
              className={`${warningColor} font-bold animate-pulse`}
              style={{ fontSize: valueFontSize }}
            >
              {warningMsg}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex items-center justify-between ${isCompact ? 'mb-0 pb-0.5' : 'mb-1 pb-2 border-b border-slate-600/50'}`}
      >
        <div className={`flex items-center ${isCompact ? 'gap-3' : 'gap-6'}`}>
          <div className="flex items-center gap-2">
            <span
              className="text-slate-500 font-semibold tracking-wider"
              style={{ fontSize: labelFontSize }}
            >
              STOPS
            </span>
            <span
              className="text-white font-bold"
              style={{ fontSize: valueFontSize }}
            >
              {stopsRemaining}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-slate-500 font-semibold tracking-wider"
              style={{ fontSize: labelFontSize }}
            >
              EARLIEST
            </span>
            <span
              className="text-green-400 font-bold"
              style={{ fontSize: valueFontSize }}
            >
              L{pitWindowOpen}
            </span>
          </div>
        </div>
        <div className="flex items-center">
          <div
            className="flex items-center gap-2"
            title={`${confidence} confidence`}
          >
            <div
              className={`w-2 h-2 rounded-full ${confConfig.bg} ${confConfig.pulse}`}
            ></div>
            <span
              className={`${confConfig.color} font-bold`}
              style={{ fontSize: valueFontSize }}
            >
              {lapsText}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

FuelCalculatorHeader.displayName = 'FuelCalculatorHeader';
