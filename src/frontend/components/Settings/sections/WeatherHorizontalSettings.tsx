import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  getWidgetDefaultConfig,
  type WeatherHorizontalWidgetSettings,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';

const SETTING_ID = 'weatherhorizontal';
const defaultConfig = getWidgetDefaultConfig('weatherhorizontal');

export const WeatherHorizontalSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as WeatherHorizontalWidgetSettings | undefined;
  const [settings, setSettings] = useState<WeatherHorizontalWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as WeatherHorizontalWidgetSettings['config']) ??
      defaultConfig,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Weather (Horizontal)"
      description="Two-row horizontal layout showing temperatures, track wetness, and rubber state."
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
              title="Temperature Units"
              value={settings.config.units ?? 'auto'}
              options={[
                { label: 'Auto', value: 'auto' },
                { label: '°C', value: 'Metric' },
                { label: '°F', value: 'Imperial' },
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
              description="If enabled, the widget will only be shown when driving"
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
