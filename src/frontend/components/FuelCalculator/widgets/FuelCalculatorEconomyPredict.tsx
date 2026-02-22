import { memo } from 'react';
import type { FuelCalculatorWidgetProps } from '../types';

/* eslint-disable react/prop-types */

export const FuelCalculatorEconomyPredict = memo<FuelCalculatorWidgetProps>(
  ({ fuelData, displayData, settings, widgetId, customStyles, isCompact }) => {
    const widgetStyle =
      customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) || {};
    const labelFontSize = widgetStyle.labelFontSize
      ? `${widgetStyle.labelFontSize}px`
      : widgetStyle.fontSize
        ? `${widgetStyle.fontSize}px`
        : '12px';
    const valueFontSize = widgetStyle.valueFontSize
      ? `${widgetStyle.valueFontSize}px`
      : widgetStyle.fontSize
        ? `${widgetStyle.fontSize * 1.2}px`
        : '14px';

    const scenariosToShow = displayData?.targetScenarios || [];

    if (
      !fuelData ||
      !displayData ||
      !scenariosToShow ||
      scenariosToShow.length === 0
    ) {
      return (
        <div
          className={`flex items-center justify-center w-full rounded bg-slate-900/40 text-slate-500 italic`}
          style={{ fontSize: labelFontSize, minHeight: '30px' }}
        >
          Needs Fuel Data
        </div>
      );
    }

    return (
      <div
        className={`flex flex-row items-center justify-around w-full ${isCompact ? 'gap-0.5' : 'gap-2'}`}
      >
        {scenariosToShow.map((scenario) => {
          const isCurrent = scenario.isCurrentTarget;
          const lapsRemaining = scenario.laps;
          const absoluteTargetLap = Math.floor(
            displayData.currentLap + lapsRemaining
          ).toString();
          const fuelPerLap = scenario.fuelPerLap.toFixed(2);

          const textColor = isCurrent ? 'text-green-400' : 'text-slate-300';
          const valueColor = isCurrent
            ? 'text-green-400 font-bold'
            : 'text-slate-200';
          const bgColor = isCurrent ? 'bg-green-500/10' : 'bg-transparent';

          return (
            <div
              key={lapsRemaining}
              className={`flex flex-col items-center justify-center rounded px-2 ${bgColor} ${isCompact ? 'py-0.5' : 'py-1'}`}
            >
              <span
                className={`${textColor} uppercase leading-none`}
                style={{ fontSize: labelFontSize }}
              >
                L{absoluteTargetLap}
              </span>
              <span
                className={`${valueColor} leading-none mt-0.5`}
                style={{ fontSize: valueFontSize }}
              >
                {fuelPerLap}{' '}
                <span className="text-[0.7em] text-slate-500">
                  {settings?.fuelUnits || 'L'}/lap
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }
);

FuelCalculatorEconomyPredict.displayName = 'FuelCalculatorEconomyPredict';
