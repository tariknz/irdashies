import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { WidgetScaleSettings } from '../components/WidgetScaleSettings';
import {
  WeatherWidgetSettings,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingProps, settingPropFor } from '../components/SettingProp';

const SETTING_ID = 'weather';
const SettingProp = settingPropFor(SETTING_ID);
const defaultConfig = getWidgetDefaultConfig('weather');

export const WeatherSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as WeatherWidgetSettings | undefined;
  const [settings, setSettings] = useState<WeatherWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: {
      ...defaultConfig,
      ...(savedSettings?.config as WeatherWidgetSettings['config']),
    },
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Weather"
      description="Track surface state, air and track temperature, wind and a trend-based forecast."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <WidgetScaleSettings widgetId={SETTING_ID} />
          <SettingsSection title="Options">
            <SettingProp path="background.opacity" />
            <SettingProp path="units" />
            <SettingProp path="forecast.enabled" />
          </SettingsSection>
          <SettingsSection title="Session Visibility">
            <SessionVisibility
              sessionVisibility={settings.config.sessionVisibility}
              handleConfigChange={handleConfigChange}
            />
            <SettingDivider />
            <SettingProp path="showOnlyWhenOnTrack" />
          </SettingsSection>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
