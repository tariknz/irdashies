import { useEffect, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { WidgetScaleSettings } from '../components/WidgetScaleSettings';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  getWidgetManifest,
  isConfigValid,
  type DashboardWidget,
  type WindWidgetSettings,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import { SettingsSection } from '../components/SettingSection';

const SETTING_ID = 'wind';
const SettingProp = settingPropFor(SETTING_ID);
const defaultConfig = getWidgetDefaultConfig('wind');

// Values a saved config predates come from the defaults, so adding a
// property to the manifest doesn't invalidate every saved wind config.
const withDefaults = (config: unknown) =>
  deepMergeConfig(
    defaultConfig as unknown as Record<string, unknown>,
    config
  ) as unknown as WindWidgetSettings['config'];

const isWindWidgetSettings = (
  widget: DashboardWidget | undefined
): widget is DashboardWidget & WindWidgetSettings =>
  widget?.id === SETTING_ID &&
  isConfigValid(
    getWidgetManifest(SETTING_ID)?.properties ?? {},
    withDefaults(widget.config)
  );

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
      ? withDefaults(savedSettings.config)
      : defaultConfig,
  }));

  useEffect(() => {
    if (!currentDashboard) return;

    const nextSettings: WindWidgetSettings = {
      enabled: isWindWidgetSettings(savedSettings)
        ? savedSettings.enabled
        : false,
      config: isWindWidgetSettings(savedSettings)
        ? withDefaults(savedSettings.config)
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
              <WidgetScaleSettings widgetId={SETTING_ID} />
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
