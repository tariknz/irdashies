import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  getWidgetDefaultConfig,
  type WindWidgetSettings,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingsSection } from '../components/SettingSection';

const SETTING_ID = 'wind';
const defaultConfig = getWidgetDefaultConfig('wind');

export const WindSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as WindWidgetSettings | undefined;
  const [settings, setSettings] = useState<WindWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as WindWidgetSettings['config']) ?? defaultConfig,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Wind"
      description="Show wind direction and speed."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <SettingsSection title="Options">
            <SettingSliderRow
              title="Background Opacity"
              value={settings.config.background.opacity ?? 80}
              units="%"
              min={0}
              max={100}
              step={1}
              onChange={(v) =>
                handleConfigChange({ background: { opacity: v } })
              }
            />

            <SettingButtonGroupRow<'auto' | 'Metric' | 'Imperial'>
              title="Speed Units"
              value={settings.config.units ?? 'auto'}
              options={[
                { label: 'Auto', value: 'auto' },
                { label: 'km/h', value: 'Metric' },
                { label: 'mph', value: 'Imperial' },
              ]}
              onChange={(v) => handleConfigChange({ units: v })}
            />
          </SettingsSection>

          <SettingsSection title="Visibility">
            <SessionVisibility
              sessionVisibility={settings.config.sessionVisibility}
              handleConfigChange={handleConfigChange}
            />

            <SettingDivider />

            <SettingToggleRow
              title="Show only when on track"
              description="If enabled, wind will only be shown when driving"
              enabled={settings.config.showOnlyWhenOnTrack ?? false}
              onToggle={(newValue) =>
                handleConfigChange({ showOnlyWhenOnTrack: newValue })
              }
            />
          </SettingsSection>
        </div>
      )}
    </BaseSettingsSection>
  );
};
