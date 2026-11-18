import { SettingNumberRow } from '../../components/SettingNumberRow';
import { SettingsSection } from '../../components/SettingSection';
import { FuelWidgetSettings } from '@irdashies/types';
import { HeightInput } from './HeightInput';
import { settingPropFor } from '../../components/SettingProp';

const SettingProp = settingPropFor('fuel');

interface FuelHistorySectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const FuelHistorySection = ({
  settings,
  onChange,
}: FuelHistorySectionProps) => {
  if (settings.config.showFuelHistory === false) return null;

  const isTable = settings.config.fuelHistoryType === 'table';

  return (
    <SettingsSection title="Fuel History">
      <SettingProp path="fuelHistoryType" />
      {isTable ? (
        <SettingProp path="fuelHistoryLapCount" />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Graph Height</span>
            <div className="flex items-center gap-4">
              <HeightInput
                widgetId="fuelGraph"
                settings={settings}
                onChange={onChange}
              />
            </div>
          </div>
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
