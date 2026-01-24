import { formatFuel } from '../fuelCalculations';

interface FuelLevelWidgetProps {
  fuelLevel: number;
  fuelUnits: 'L' | 'gal';
  layout: 'vertical' | 'horizontal';
  headerFontSize: string;
  headerTextClasses: string;
}

export const FuelLevelWidget = ({
  fuelLevel,
  fuelUnits,
  headerFontSize,
  headerTextClasses,
}: FuelLevelWidgetProps) => {
  return (
    <div className="flex flex-col items-center flex-1 min-w-[60px]">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
        Fuel
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`${headerFontSize} font-semibold ${headerTextClasses} leading-none transition-all duration-300`}
        >
          {formatFuel(fuelLevel, fuelUnits, 1).split(' ')[0]}
        </span>
        <span className="text-xs text-slate-500">{fuelUnits}</span>
      </div>
    </div>
  );
};

interface LapsRemainingWidgetProps {
  lapsRemaining: number;
  headerFontSize: string;
  headerTextClasses: string;
}

export const LapsRemainingWidget = ({
  lapsRemaining,
  headerFontSize,
  headerTextClasses,
}: LapsRemainingWidgetProps) => {
  return (
    <div className="flex flex-col items-center flex-1 min-w-[60px]">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
        Laps
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`${headerFontSize} font-semibold ${headerTextClasses} leading-none transition-all duration-300`}
        >
          {lapsRemaining.toFixed(1)}
        </span>
      </div>
    </div>
  );
};

interface FuelHeaderCombinedWidgetProps {
    fuelLevel: number;
    lapsRemaining: number;
    fuelUnits: 'L' | 'gal';
    headerFontSize: string;
    headerTextClasses: string;
    showFuelLevel?: boolean;
    showLapsRemaining?: boolean;
}
  
export const FuelHeaderCombinedWidget = ({
    fuelLevel,
    lapsRemaining,
    fuelUnits,
    headerFontSize,
    headerTextClasses,
    showFuelLevel = true,
    showLapsRemaining = true
}: FuelHeaderCombinedWidgetProps) => {
    if (!showFuelLevel && !showLapsRemaining) return null;

    return (
        <div className="w-full h-full flex items-center justify-around px-4">
             {/* Fuel Level Part */}
            {showFuelLevel && (
                <div className="flex flex-col items-center justify-center flex-1">
                     <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Fuel</div>
                     <div className="flex items-baseline gap-1">
                         <span className={`${headerFontSize} font-semibold ${headerTextClasses} leading-none`}>
                             {formatFuel(fuelLevel, fuelUnits, 1).split(' ')[0]}
                         </span>
                         <span className="text-xs text-slate-500 font-medium">{fuelUnits}</span>
                     </div>
                </div>
            )}

            {/* Divider */}
            {showFuelLevel && showLapsRemaining && (
                <div className="h-2/3 w-px bg-slate-700/50 mx-4"></div>
            )}

            {/* Laps Remaining Part */}
            {showLapsRemaining && (
                <div className="flex flex-col items-center justify-center flex-1">
                     <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Laps</div>
                     <div className="flex items-baseline gap-1">
                         <span className={`${headerFontSize} font-semibold ${headerTextClasses} leading-none`}>
                             {Number.isFinite(lapsRemaining) ? lapsRemaining.toFixed(1) : '--'}
                         </span>
                     </div>
                </div>
            )}
        </div>
    );
};
