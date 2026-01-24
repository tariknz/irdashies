import { formatFuel } from '../fuelCalculations';

interface ConsumptionWidgetProps {
  displayData: any;
  fuelMetrics: any;
  fuelUnits: 'L' | 'gal';
  settings: any;
  getToFinishColorClass: (val: number) => string;
  layout: 'vertical' | 'horizontal';
}

export const ConsumptionWidget = ({
  displayData,
  fuelMetrics,
  fuelUnits,
  settings,
  getToFinishColorClass,
  layout,
}: ConsumptionWidgetProps) => {
  const {
    showMin,
    showLastLap,
    show3LapAvg,
    show10LapAvg,
    showFuelRequired,
    fuelRequiredMode,
  } = settings;

  if (!settings.showConsumption) return null;

  const isHorizontal = layout === 'horizontal';

  return (
    <div className={`w-full ${isHorizontal ? 'h-full flex flex-col justify-center' : 'mb-3 pb-2 border-b border-slate-600/30'}`}>
      {/* Table Header */}
      {!isHorizontal && (
        <div className="grid grid-cols-3 gap-1 mb-1">
          <span className="text-xs text-slate-500 uppercase tracking-wide"></span>
          <span className="text-xs text-slate-500 uppercase tracking-wide text-right">
            Per Lap
          </span>
          {showFuelRequired && fuelMetrics && (
            <span className="text-xs text-slate-500 uppercase tracking-wide text-right">
              {fuelRequiredMode === 'toAdd' ? 'Fuel to Add' : 'To Finish'}
            </span>
          )}
        </div>
      )}
      {/* Table Rows */}
      <div className={`${isHorizontal ? 'flex flex-row justify-around gap-4' : 'flex flex-col'}`}>
        {showMin && (
          <div className={`${isHorizontal ? 'flex flex-col items-center' : 'grid grid-cols-3 gap-1 py-1'} hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors`}>
            <span className="text-slate-400 text-[10px] uppercase whitespace-nowrap">Min</span>
            <span className={`text-white text-sm font-medium ${isHorizontal ? 'text-center' : 'text-right'}`}>
              {formatFuel(displayData.minLapUsage, fuelUnits)}
            </span>
            {showFuelRequired && fuelMetrics && !isHorizontal && (
              <span
                className={`text-sm font-medium text-right ${getToFinishColorClass(fuelMetrics.min.toFinish).replace('/70', '')}`}
              >
                {formatFuel(
                  fuelRequiredMode === 'toAdd'
                    ? fuelMetrics.min.toAdd
                    : fuelMetrics.min.toFinish,
                  fuelUnits,
                  1
                )}
              </span>
            )}
          </div>
        )}
        {showLastLap && (
          <div className={`${isHorizontal ? 'flex flex-col items-center' : 'grid grid-cols-3 gap-1 py-1'} hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors`}>
            <span className="text-slate-400 text-[10px] uppercase whitespace-nowrap">Last</span>
            <span className={`text-white text-sm font-medium ${isHorizontal ? 'text-center' : 'text-right'}`}>
              {formatFuel(displayData.lastLapUsage, fuelUnits)}
            </span>
            {showFuelRequired && fuelMetrics && !isHorizontal && (
              <span
                className={`text-sm font-medium text-right ${getToFinishColorClass(fuelMetrics.last.toFinish).replace('/70', '')}`}
              >
                {formatFuel(
                  fuelRequiredMode === 'toAdd'
                    ? fuelMetrics.last.toAdd
                    : fuelMetrics.last.toFinish,
                  fuelUnits,
                  1
                )}
              </span>
            )}
          </div>
        )}
        {show3LapAvg && (
          <div className={`${isHorizontal ? 'flex flex-col items-center' : 'grid grid-cols-3 gap-1 py-1'} hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors`}>
            <span className="text-slate-400 text-[10px] uppercase whitespace-nowrap">Avg 3</span>
            <span className={`text-white text-sm font-medium ${isHorizontal ? 'text-center' : 'text-right'}`}>
              {formatFuel(displayData.avg3Laps, fuelUnits)}
            </span>
            {showFuelRequired && fuelMetrics && !isHorizontal && (
              <span
                className={`text-sm font-medium text-right ${getToFinishColorClass(fuelMetrics.avg3.toFinish).replace('/70', '')}`}
              >
                {formatFuel(
                  fuelRequiredMode === 'toAdd'
                    ? fuelMetrics.avg3.toAdd
                    : fuelMetrics.avg3.toFinish,
                  fuelUnits,
                  1
                )}
              </span>
            )}
          </div>
        )}
        {show10LapAvg && (
          <div className={`${isHorizontal ? 'flex flex-col items-center' : 'grid grid-cols-3 gap-1 py-1'} hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors`}>
            <span className="text-slate-400 text-[10px] uppercase whitespace-nowrap">Avg 10</span>
            <span className={`text-white text-sm font-medium ${isHorizontal ? 'text-center' : 'text-right'}`}>
              {formatFuel(displayData.avg10Laps, fuelUnits)}
            </span>
            {showFuelRequired && fuelMetrics && !isHorizontal && (
              <span
                className={`text-sm font-medium text-right ${getToFinishColorClass(fuelMetrics.avg.toFinish).replace('/70', '')}`}
              >
                {formatFuel(
                  fuelRequiredMode === 'toAdd'
                    ? fuelMetrics.avg.toAdd
                    : fuelMetrics.avg.toFinish,
                  fuelUnits,
                  1
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

