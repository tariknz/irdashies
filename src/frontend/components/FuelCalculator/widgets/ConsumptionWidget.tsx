import { formatFuel } from '../fuelCalculations';

interface ConsumptionWidgetProps {
  displayData: any;
  fuelMetrics: any;
  fuelUnits: 'L' | 'gal';
  settings: any;
  getToFinishColorClass: (val: number) => string;
}

export const ConsumptionWidget = ({
  displayData,
  fuelMetrics,
  fuelUnits,
  settings,
  getToFinishColorClass,
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

  return (
    <div className="mb-3 pb-2 border-b border-slate-600/30 w-full">
      {/* Table Header */}
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
      {/* Table Rows */}
      {showMin && (
        <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
          <span className="text-slate-400 text-xs">Min</span>
          <span className="text-white text-sm font-medium text-right">
            {formatFuel(displayData.minLapUsage, fuelUnits)}
          </span>
          {showFuelRequired && fuelMetrics && (
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
        <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
          <span className="text-slate-400 text-xs">Last Lap</span>
          <span className="text-white text-sm font-medium text-right">
            {formatFuel(displayData.lastLapUsage, fuelUnits)}
          </span>
          {showFuelRequired && fuelMetrics && (
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
        <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
          <span className="text-slate-400 text-xs">3 Lap Avg</span>
          <span className="text-white text-sm font-medium text-right">
            {formatFuel(displayData.avg3Laps, fuelUnits)}
          </span>
          {showFuelRequired && fuelMetrics && (
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
        <div className="grid grid-cols-3 gap-1 py-1 hover:bg-white/5 hover:mx-[-4px] hover:px-1 rounded transition-colors">
          <span className="text-slate-400 text-xs">10 Lap Avg</span>
          <span className="text-white text-sm font-medium text-right">
            {formatFuel(displayData.avg10Laps, fuelUnits)}
          </span>
          {showFuelRequired && fuelMetrics && (
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
  );
};
