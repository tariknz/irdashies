import { useEffect, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  getWidgetManifest,
  isConfigValid,
  type DamageWidgetSettings,
  type DashboardWidget,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import { SettingsSection } from '../components/SettingSection';

const SETTING_ID = 'damage';
const SettingProp = settingPropFor(SETTING_ID);
const defaultConfig = getWidgetDefaultConfig(SETTING_ID);

const withDefaults = (config: unknown) =>
  deepMergeConfig(
    defaultConfig as unknown as Record<string, unknown>,
    config
  ) as unknown as DamageWidgetSettings['config'];

const isDamageWidgetSettings = (
  widget: DashboardWidget | undefined
): widget is DashboardWidget & DamageWidgetSettings =>
  widget?.id === SETTING_ID &&
  isConfigValid(
    getWidgetManifest(SETTING_ID)?.properties ?? {},
    withDefaults(widget.config)
  );

export const DamageSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  );
  const [settings, setSettings] = useState<DamageWidgetSettings>(() => ({
    enabled: isDamageWidgetSettings(savedSettings)
      ? savedSettings.enabled
      : false,
    config: isDamageWidgetSettings(savedSettings)
      ? withDefaults(savedSettings.config)
      : defaultConfig,
  }));

  useEffect(() => {
    if (!currentDashboard) return;

    const nextSettings: DamageWidgetSettings = {
      enabled: isDamageWidgetSettings(savedSettings)
        ? savedSettings.enabled
        : false,
      config: isDamageWidgetSettings(savedSettings)
        ? withDefaults(savedSettings.config)
        : defaultConfig,
    };

    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) return;
      setSettings((current) =>
        current.enabled === nextSettings.enabled &&
        current.config === nextSettings.config
          ? current
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
      title="Damage"
      description="Top-down damage silhouette matched to your car class (GT, prototype, open-wheel, hatch, stock, truck). LMU: panel dents. iRacing: repair flags and tyre wear."
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
            <SettingsSection title="Display">
              <SettingProp path="background.opacity" />
              <SettingProp path="showIntegrity" />
              <SettingProp path="showStats" />
            </SettingsSection>

            <SettingsSection title="Visibility">
              <SessionVisibility
                sessionVisibility={settings.config.sessionVisibility}
                handleConfigChange={handleConfigChange}
              />
              <SettingDivider />
              <SettingProp path="showOnlyWhenOnTrack" />
              <SettingProp path="showOnlyWhenDamaged" />
            </SettingsSection>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
