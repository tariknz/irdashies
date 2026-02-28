import { FuelWidgetSettings } from '../../types';
import { defaultFuelCalculatorSettings } from '../../../FuelCalculator/defaults';
import { ToggleSwitch } from '../../components/ToggleSwitch';

const defaultConfig = defaultFuelCalculatorSettings;

interface FuelStatusAlertsSectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const FuelStatusAlertsSection = ({
  settings,
  onChange,
}: FuelStatusAlertsSectionProps) => {
  return (
    <div className="space-y-4 pb-4 mb-4 border-b border-slate-700">
      <h4 className="text-lg font-medium text-slate-200">Fuel Status Alerts</h4>

      {/* Border Color Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-slate-300">Show Border Color</span>
          <span className="block text-xs text-slate-500">
            Green (safe), Orange (caution), Red (danger)
          </span>
        </div>
        <ToggleSwitch
          enabled={settings.config.showFuelStatusBorder ?? true}
          onToggle={(val) => onChange({ showFuelStatusBorder: val })}
        />
      </div>

      <div className="space-y-3">
        {/* Green Threshold */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Green Threshold (%)</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.config.fuelStatusThresholds?.green ?? 60}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onChange({
                  fuelStatusThresholds: {
                    ...defaultConfig.fuelStatusThresholds,
                    ...settings.config.fuelStatusThresholds,
                    green: val,
                  } as NonNullable<
                    FuelWidgetSettings['config']['fuelStatusThresholds']
                  >,
                });
              }}
              className="w-32 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-slate-300 w-8 text-right">
              {settings.config.fuelStatusThresholds?.green ?? 60}%
            </span>
          </div>
        </div>

        {/* Amber Threshold */}
        <div className="flex items-center justify-between ">
          <span className="text-sm text-slate-300">Amber Threshold (%)</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.config.fuelStatusThresholds?.amber ?? 30}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onChange({
                  fuelStatusThresholds: {
                    ...defaultConfig.fuelStatusThresholds,
                    ...settings.config.fuelStatusThresholds,
                    amber: val,
                  } as NonNullable<
                    FuelWidgetSettings['config']['fuelStatusThresholds']
                  >,
                });
              }}
              className="w-32 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-slate-300 w-8 text-right">
              {settings.config.fuelStatusThresholds?.amber ?? 30}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
