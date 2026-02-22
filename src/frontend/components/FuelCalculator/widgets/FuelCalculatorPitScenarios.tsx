import React, { memo } from 'react';
import type {
  FuelCalculation,
  FuelCalculatorSettings,
  FuelCalculatorWidgetProps,
} from '../types';

/* eslint-disable react/prop-types */

const TargetScenarioRow: React.FC<{
  targetLap: number;
  fuelData: FuelCalculation;
  displayData: FuelCalculation;
  settings: FuelCalculatorSettings;
  valueFontSize: string;
  isTesting: boolean;
}> = ({
  targetLap,
  fuelData,
  displayData,
  settings,
  valueFontSize,
  isTesting,
}) => {
  const lapsLeftAfterPit = Math.max(0, fuelData.totalLaps - targetLap);
  const safetyMargin = settings?.safetyMargin ?? 0.05;
  const basis = settings?.targetPitLapBasis || 'avg';
  let consumption = displayData.avgLaps;

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
      consumption = displayData.maxQualify || 0;
      break;
  }

  consumption =
    consumption || displayData.avgLaps || displayData.avg10Laps || 0;
  const fuelToAddHypothetical =
    lapsLeftAfterPit * consumption * (1 + safetyMargin);
  const fuelBurnedToFinish = lapsLeftAfterPit * consumption;
  const estimatedFinishFuel = Math.max(
    0,
    fuelToAddHypothetical - fuelBurnedToFinish
  );

  const addDisplay =
    isTesting || consumption === 0
      ? '--'
      : `+${fuelToAddHypothetical.toFixed(1)}`;
  const finishDisplay =
    isTesting || consumption === 0 ? '--' : estimatedFinishFuel.toFixed(1);
  const rowColor = 'text-purple-400 font-bold bg-purple-500/20 rounded';

  return (
    <React.Fragment>
      <div
        className={`${rowColor} py-0.5 text-center`}
        style={{ fontSize: valueFontSize }}
      >
        L{targetLap}
      </div>
      <div
        className={`${rowColor} text-center py-0.5`}
        style={{ fontSize: valueFontSize }}
      >
        {addDisplay}
      </div>
      <div
        className={`${rowColor} text-center py-0.5`}
        style={{ fontSize: valueFontSize }}
      >
        {finishDisplay}
      </div>
      <div
        className={`${rowColor} text-center py-0.5`}
        style={{ fontSize: valueFontSize }}
      >
        TARGET
      </div>
    </React.Fragment>
  );
};

export const FuelCalculatorPitScenarios = memo<FuelCalculatorWidgetProps>(
  ({
    fuelData,
    displayData,
    settings,
    widgetId,
    customStyles,
    isCompact,
    sessionType,
  }) => {
    if (!fuelData || !displayData) return null;

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

    const isTesting = sessionType === 'Offline Testing';

    if (settings && settings.showFuelScenarios === false) return null;

    if (
      !fuelData ||
      !displayData.targetScenarios ||
      displayData.targetScenarios.length === 0
    ) {
      return (
        <div>
          <div className="border-t border-slate-600/30 mb-2"></div>
          <div
            className="text-[0.75em] text-center text-slate-400 mb-3 py-2 bg-slate-900/40 rounded"
            style={{ fontSize: labelFontSize }}
          >
            Pit scenarios available after more laps
          </div>
        </div>
      );
    }

    return (
      <div>
        <div
          className={`border-t border-slate-600/30 ${isCompact ? 'mb-0.5' : 'mb-2'}`}
        ></div>

        <div
          className={`grid grid-cols-4 ${isCompact ? 'gap-0 md:gap-x-1 mb-0.5' : 'gap-1 mb-3'}`}
        >
          <div
            className="text-slate-500 text-center"
            style={{ fontSize: labelFontSize }}
          >
            PIT @
          </div>
          <div
            className="text-slate-500 text-center"
            style={{ fontSize: labelFontSize }}
          >
            ADD
          </div>
          <div
            className="text-slate-500 text-center"
            style={{ fontSize: labelFontSize }}
          >
            FINISH
          </div>
          <div
            className="text-slate-500 text-center"
            style={{ fontSize: labelFontSize }}
          >
            WINDOW
          </div>

          {displayData.targetScenarios.map((scenario) => {
            const pitLap = fuelData.currentLap + scenario.laps;

            const lapsLeftAfterPit = Math.max(0, fuelData.totalLaps - pitLap);
            const safetyMargin = settings?.safetyMargin ?? 0.05;
            const consumption =
              displayData.avgLaps || displayData.avg10Laps || 0;
            const marginAmount =
              settings?.fuelUnits === 'gal'
                ? safetyMargin * 3.78541
                : safetyMargin;
            const calculationFuelNeeded =
              lapsLeftAfterPit * consumption + marginAmount;
            const fuelToAddHypothetical = Math.max(0, calculationFuelNeeded);

            const fuelBurnedToFinish = lapsLeftAfterPit * consumption;
            const estimatedFinishFuel = Math.max(
              0,
              fuelToAddHypothetical - fuelBurnedToFinish
            );

            let windowStatus = '';
            if (scenario.isCurrentTarget) {
              windowStatus = 'Ideal';
            } else if (scenario.laps < (displayData.lapsWithFuel || 0)) {
              windowStatus = '-1 Lap';
            } else {
              windowStatus = '+1 Lap';
            }

            const addDisplay = isTesting
              ? '--'
              : `+${fuelToAddHypothetical.toFixed(1)}`;
            const finishDisplay = isTesting
              ? '--'
              : estimatedFinishFuel.toFixed(1);
            const windowDisplay = isTesting ? '--' : windowStatus;

            let rowColor = 'text-cyan-400';
            if (windowStatus === 'Ideal') rowColor = 'text-green-400 font-bold';
            else if (windowStatus === '+1 Lap')
              rowColor = 'text-cyan-400 font-bold';
            else rowColor = 'text-yellow-400';

            return (
              <React.Fragment key={scenario.laps}>
                <div
                  className={`${rowColor} py-0.5 text-center`}
                  style={{ fontSize: valueFontSize }}
                >
                  L{pitLap}
                </div>
                <div
                  className={`${rowColor} text-center py-0.5`}
                  style={{ fontSize: valueFontSize }}
                >
                  {addDisplay}
                </div>
                <div
                  className={`${rowColor} text-center py-0.5`}
                  style={{ fontSize: valueFontSize }}
                >
                  {finishDisplay}
                </div>
                <div
                  className={`${rowColor} text-center py-0.5`}
                  style={{ fontSize: valueFontSize }}
                >
                  {windowDisplay}
                </div>
              </React.Fragment>
            );
          })}

          {settings?.enableTargetPitLap && settings.targetPitLap && (
            <TargetScenarioRow
              targetLap={settings.targetPitLap}
              fuelData={fuelData}
              displayData={displayData}
              settings={settings}
              valueFontSize={valueFontSize}
              isTesting={isTesting}
            />
          )}
        </div>
      </div>
    );
  }
);

FuelCalculatorPitScenarios.displayName = 'FuelCalculatorPitScenarios';
