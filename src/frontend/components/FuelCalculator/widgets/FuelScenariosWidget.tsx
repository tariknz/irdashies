import { formatFuel } from '../fuelCalculations';

interface FuelScenariosWidgetProps {
  displayData: any;
  showFuelScenarios: boolean;
  fuelUnits: 'L' | 'gal';
  editMode?: boolean;
}

export const FuelScenariosWidget = ({
  displayData,
  showFuelScenarios,
  fuelUnits,
  editMode
}: FuelScenariosWidgetProps) => {
  const hasData = displayData.targetScenarios && displayData.targetScenarios.length > 0;
  
  if (!showFuelScenarios) return null;

  const scenarios = hasData ? displayData.targetScenarios : [];

  return (
    <div className="flex flex-col justify-center min-w-[120px] w-full py-1">
      <div className="text-[8px] text-slate-400 uppercase mb-1 text-center">
        Target
      </div>
      <div className="flex gap-1.5 justify-center">
        {hasData ? (
            scenarios.map((scenario: any) => (
              <div key={scenario.laps} className="flex flex-col items-center">
                <div
                  className={`text-[9px] ${
                    scenario.isCurrentTarget ? 'text-blue-400' : 'text-slate-400'
                  }`}
                >
                  {scenario.laps}L
                </div>
                <div
                  className={`text-xs font-semibold ${
                    scenario.isCurrentTarget ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  {
                    formatFuel(scenario.fuelPerLap, fuelUnits, 2).split(
                      ' '
                    )[0]
                  }
                </div>
              </div>
            ))
        ) : (
            <div className="flex gap-4 opacity-50">
               <div className="flex flex-col items-center">
                  <div className="text-[9px] text-slate-500">-- L</div>
                  <div className="text-xs text-slate-600">--</div>
               </div>
               <div className="flex flex-col items-center">
                  <div className="text-[9px] text-slate-500">-- L</div>
                  <div className="text-xs text-slate-600">--</div>
               </div>
            </div>
        )}
      </div>
    </div>
  );
};
