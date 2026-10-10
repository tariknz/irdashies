import { useEffect, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  getWidgetDefaultConfig,
  getWidgetManifest,
  isConfigValid,
  type DashboardWidget,
  type WindWidgetSettings,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProp, SettingProps } from '../components/SettingProp';
import { SettingsSection } from '../components/SettingSection';

const SETTING_ID = 'wind';
const defaultConfig = getWidgetDefaultConfig('wind');

const isWindWidgetSettings = (
  widget: DashboardWidget | undefined
): widget is DashboardWidget & WindWidgetSettings =>
  widget?.id === SETTING_ID &&
  isConfigValid(getWidgetManifest(SETTING_ID)?.properties ?? {}, widget.config);

export const WindSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  );
  const [settings, setSettings] = useState<WindWidgetSettings>(() => ({
    enabled: isWindWidgetSettings(savedSettings)
      ? savedSettings.enabled
      : false,
    config: isWindWidgetSettings(savedSettings)
      ? savedSettings.config
      : defaultConfig,
  }));

  useEffect(() => {
    if (!currentDashboard) return;

    const nextSettings: WindWidgetSettings = {
      enabled: isWindWidgetSettings(savedSettings)
        ? savedSettings.enabled
        : false,
      config: isWindWidgetSettings(savedSettings)
        ? savedSettings.config
        : defaultConfig,
    };

    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;

      setSettings((settings) =>
        settings.enabled === nextSettings.enabled &&
        settings.config === nextSettings.config
          ? settings
          : nextSettings
      );
    });

    return () => {
      isActive = false;
    };
  }, [currentDashboard, savedSettings]);

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
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <div className="space-y-4">
            <SettingsSection title="Options">
              <SettingProp path="background.opacity" />
              <SettingProp path="units" />
            </SettingsSection>

            <SettingsSection title="Visibility">
              <SessionVisibility
                sessionVisibility={settings.config.sessionVisibility}
                handleConfigChange={handleConfigChange}
              />

              <SettingDivider />

              <SettingProp path="showOnlyWhenOnTrack" />
            </SettingsSection>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
