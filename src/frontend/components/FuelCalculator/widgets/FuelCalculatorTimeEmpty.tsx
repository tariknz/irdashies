import { memo } from 'react';
import type { FuelCalculatorWidgetProps } from '../types';
import { getFuelStatusColors } from './FuelCalculatorGauge';

/* eslint-disable react/prop-types */

export const FuelCalculatorTimeEmpty = memo<FuelCalculatorWidgetProps>(
  ({ fuelData, displayData, settings, widgetId, customStyles, isCompact }) => {
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
        : '24px';

    if (!fuelData || !displayData) return null;

    // Calculate time until empty
    // lapsWithFuel * avgLapTime
    const secondsLeft = displayData.lapsWithFuel * (fuelData.avgLapTime || 0);

    // Format to HH:MM:SS
    const formatTime = (secs: number) => {
      if (!secs || secs < 0) return '00:00:00';
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Fuel status border color
    const status = fuelData.fuelStatus || 'safe';
    const statusColors = getFuelStatusColors(status);
    const borderColor = statusColors.border;

    return (
      <div
        className={`rounded border ${borderColor} ${isCompact ? 'px-2 py-0.5' : 'px-3 py-2'}`}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-slate-400 uppercase"
            style={{ fontSize: labelFontSize }}
          >
            Time Empty
          </span>
          <span
            className="font-mono font-bold text-white tracking-widest"
            style={{ fontSize: valueFontSize }}
          >
            {formatTime(secondsLeft)}
          </span>
        </div>
      </div>
    );
  }
);

FuelCalculatorTimeEmpty.displayName = 'FuelCalculatorTimeEmpty';
