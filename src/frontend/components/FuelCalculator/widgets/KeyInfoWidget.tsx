import { formatFuel } from '../fuelCalculations';

interface KeyInfoWidgetProps {
  displayData: any;
  fuelUnits: 'L' | 'gal';
}

export const KeyInfoWidget = ({
  displayData,
  fuelUnits,
}: KeyInfoWidgetProps) => {
  return (
    <div data-widget-id="keyInfo" className="flex items-center gap-2 pr-3 border-r border-slate-600/50 min-w-fit border border-magenta-500/20">
      <div className="flex flex-col items-center min-w-[50px]">
        <div className="text-[8px] text-slate-400 uppercase">
          To Finish
        </div>
        <div className="text-xs font-semibold text-green-400">
          {formatFuel(displayData.fuelToFinish, fuelUnits, 1)}
        </div>
      </div>
      <div className="flex flex-col items-center min-w-[50px]">
        <div className="text-[8px] text-slate-400 uppercase">
          At Finish
        </div>
        <div
          className={`text-xs font-semibold ${displayData.fuelAtFinish >= 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {displayData.fuelAtFinish >= 0 ? '+' : ''}
          {formatFuel(Math.abs(displayData.fuelAtFinish), fuelUnits, 1)}
        </div>
      </div>
      {displayData.fuelToAdd > 0 && (
        <div className="flex flex-col items-center min-w-[50px]">
          <div className="text-[8px] text-slate-400 uppercase">Add</div>
          <div className="text-xs font-semibold text-cyan-400">
            {formatFuel(displayData.fuelToAdd, fuelUnits, 1)}
          </div>
        </div>
      )}
    </div>
  );
};
