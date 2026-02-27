import { FuelWidgetSettings } from '../../types';
import { SettingsSection } from '../../components/SettingSection';
import { SettingToggleRow } from '../../components/SettingToggleRow';
import { SettingNumberRow } from '../../components/SettingNumberRow';
import { SettingSelectRow } from '../../components/SettingSelectRow';

interface PitStrategySectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const PitStrategySection = ({
  settings,
  onChange,
}: PitStrategySectionProps) => {
  return (
    <SettingsSection title="Pit Strategy">  

      <SettingToggleRow
        title="Fixed Target Lap"
        description="Enable a specific lap target for strategy"
        enabled={settings.config.enableTargetPitLap || false}
        onToggle={(enabled) =>
          onChange({ enableTargetPitLap: enabled })
        }
      />

      {(settings.config.enableTargetPitLap) && (
        <SettingsSection>  

          <SettingNumberRow
            title="Target Pit Lap"
            description="Scenarios will include this lap as a 4th row. Target message will show fuel required."
            value={settings.config.targetPitLap ?? 15}
            min={1}
            max={200}
            step={1}
            onChange={(e) => onChange({ targetPitLap: e || 1 })}
          />

          <SettingSelectRow<'avg' | 'avg10' | 'last' | 'max' | 'min' | 'qual'>
            title="Calculated From"
            description="Lap or laps to base the caluclation on."
            value={settings.config.targetPitLapBasis ?? 'avg'}
            options={[
              { label: 'Average (' + settings.config.avgLapsCount + ')', value: 'avg' },
              { label: 'Avg 10 Laps', value: 'avg10' },
              { label: 'Last Lap', value: 'last' },
              { label: 'Max Lap', value: 'max' },
              { label: 'Min Lap', value: 'min' },
              { label: 'Qualify Max', value: 'qual' },
            ]}
            onChange={(e) => onChange({ targetPitLapBasis: e as FuelWidgetSettings['config']['targetPitLapBasis'] })}
          />

        </SettingsSection>  
      )}
      
    </SettingsSection>
  );
};
