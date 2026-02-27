import { FuelWidgetSettings } from '../../types';
import { defaultFuelCalculatorSettings } from '../../../FuelCalculator/defaults';
import { SettingsSection } from '../../components/SettingSection';
import { SettingToggleRow } from '../../components/SettingToggleRow';

const defaultConfig = defaultFuelCalculatorSettings;

interface FuelStatusAlertsSectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const FuelStatusAlertsSection = ({ settings, onChange }: FuelStatusAlertsSectionProps) => {
  return (
    <SettingsSection title="Fuel Status Alerts">  

      {/* Border Color Toggle */}
      <SettingToggleRow
        title="Show Border Color"
        description="Green (safe), Orange (caution), Red (danger)"
        enabled={settings.config.showFuelStatusBorder ?? true}
        onToggle={(enabled) =>
          onChange({ showFuelStatusBorder: enabled })
        }
      />

      <div className="space-y-3">
        {/* Green Threshold */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Green Threshold (%)</span>
          <div className="flex items-center gap-2">
            <input
              type="range" min="0" max="100" step="1"
              value={settings.config.fuelStatusThresholds?.green ?? 60}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onChange({
                  fuelStatusThresholds: {
                    ...defaultConfig.fuelStatusThresholds,
                    ...settings.config.fuelStatusThresholds,
                    green: val
                  } as NonNullable<FuelWidgetSettings['config']['fuelStatusThresholds']>
                });
              }}
              className="w-32 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-slate-300 w-8 text-right">{settings.config.fuelStatusThresholds?.green ?? 60}%</span>
          </div>
        </div>

        {/* Amber Threshold */}
        <div className="flex items-center justify-between ">
          <span className="text-sm text-slate-300">Amber Threshold (%)</span>
          <div className="flex items-center gap-2">
            <input
              type="range" min="0" max="100" step="1"
              value={settings.config.fuelStatusThresholds?.amber ?? 30}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onChange({
                  fuelStatusThresholds: {
                    ...defaultConfig.fuelStatusThresholds,
                    ...settings.config.fuelStatusThresholds,
                    amber: val
                  } as NonNullable<FuelWidgetSettings['config']['fuelStatusThresholds']>
                });
              }}
              className="w-32 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-slate-300 w-8 text-right">{settings.config.fuelStatusThresholds?.amber ?? 30}%</span>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};
