import { SettingNumberRow } from '../../components/SettingNumberRow';
import { SettingsSection } from '../../components/SettingSection';
import { SettingSelectRow } from '../../components/SettingSelectRow';
import { FuelWidgetSettings } from '../../types';
import { BarFontSizeInput, HeightInput } from './FontSizeInputs';

interface FuelHistorySectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const FuelHistorySection = ({
  settings,
  onChange,
}: FuelHistorySectionProps) => {
  return (
    <SettingsSection title="Fuel History">  

      {/* Sub-settings container */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Graph Properties</span>
          <div className="flex items-center gap-4">
            <BarFontSizeInput
              widgetId="fuelGraph"
              settings={settings}
              onChange={onChange}
            />
            <HeightInput
              widgetId="fuelGraph"
              settings={settings}
              onChange={onChange}
            />
          </div>
        </div>

        {/* Allow configuring graph type for Fuel 2 as well */}
        {settings.config.showFuelHistory !== false && (          
          <>
            {/* Graph Type & Target Wrapper */}
            <SettingSelectRow<'line' | 'histogram'>
              title="Graph Type"             
              value={settings.config.fuelHistoryType ?? 'line'}
              options={[
                { label: 'Line Chart', value: 'line' },
                { label: 'Histogram', value: 'histogram' },
              ]}
              onChange={(e) => onChange({ fuelHistoryType: e })}
            />       

            <SettingNumberRow
              title="Target Line"
              description="Optional ref (0 to hide)."
              value={settings.config.manualTarget ?? 0}
              min={0}
              step={0.1}
              onChange={(e) => onChange({ manualTarget: e })}
            />   
          </>        
        )}

    </SettingsSection>
  );
};
