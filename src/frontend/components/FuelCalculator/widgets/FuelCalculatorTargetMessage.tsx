import { memo } from 'react';
import type { FuelCalculatorWidgetProps } from '../types';

/* eslint-disable react/prop-types */

export const FuelCalculatorTargetMessage = memo<FuelCalculatorWidgetProps>(
  ({
    fuelData,
    displayData,
    settings,
    widgetId,
    customStyles,
    isCompact,
    sessionType,
  }) => {
    const isTesting =
      sessionType === 'Offline Testing' || sessionType === 'Practice';

    if (
      !settings?.enableTargetPitLap ||
      !settings.targetPitLap ||
      !fuelData ||
      !displayData
    )
      return null;

    const targetLap = settings.targetPitLap;
    const lapsLeftAfterPit = Math.max(0, fuelData.totalLaps - targetLap);
    const safetyMargin = settings?.safetyMargin ?? 0.05;
    const basis = settings?.targetPitLapBasis || 'avg';
    let consumption: number | null = displayData.avgLaps;

    switch (basis) {
      case 'avg':
        consumption = displayData.avgLaps;
        break;
      case 'avg10':
        consumption = displayData.avg10Laps;
        break;
      case 'last':
        consumption = displayData.lastLapUsage;
        break;
      case 'max':
        consumption = displayData.maxLapUsage;
        break;
      case 'min':
        consumption = displayData.minLapUsage;
        break;
      case 'qual':
        consumption = displayData.maxQualify ?? 0;
        break;
    }

    consumption =
      consumption || displayData.avgLaps || displayData.avg10Laps || 0;
    const marginAmount =
      settings?.fuelUnits === 'gal' ? safetyMargin * 3.78541 : safetyMargin;
    const fuelNeeded = lapsLeftAfterPit * consumption + marginAmount;
    const fuelToAddHypothetical = Math.max(0, fuelNeeded);

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
        : '16px';

    const needDisplay =
      isTesting || consumption === 0
        ? '--'
        : `+${fuelToAddHypothetical.toFixed(1)}L`;

    return (
      <div
        className={`py-1 px-2 bg-purple-500/20 border border-purple-500/50 rounded flex items-center justify-between ${isCompact ? 'mb-0.5' : 'mb-2'}`}
      >
        <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2'}`}>
          <span
            className="text-purple-400 font-medium"
            style={{ fontSize: labelFontSize }}
          >
            TARGET
          </span>
          <span
            className="text-white font-bold"
            style={{ fontSize: valueFontSize }}
          >
            L{targetLap}
          </span>
        </div>
        <div className="text-xs">
          <span className="text-slate-400" style={{ fontSize: labelFontSize }}>
            Need:
          </span>
          <span
            className="text-purple-300 font-medium ml-1"
            style={{ fontSize: valueFontSize }}
          >
            {needDisplay}
          </span>
        </div>
      </div>
    );
  }
);

FuelCalculatorTargetMessage.displayName = 'FuelCalculatorTargetMessage';
