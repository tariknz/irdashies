import { useEffect, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  getWidgetDefaultConfig,
  type DashboardWidget,
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

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSessionVisibility = (value: unknown) => {
  if (!isObjectRecord(value)) return false;

  return (
    typeof value.race === 'boolean' &&
    typeof value.loneQualify === 'boolean' &&
    typeof value.openQualify === 'boolean' &&
    typeof value.practice === 'boolean' &&
    typeof value.offlineTesting === 'boolean'
  );
};

const isWindConfig = (
  config: object | undefined
): config is WindWidgetSettings['config'] => {
  if (!isObjectRecord(config)) return false;

  const { background, units, showOnlyWhenOnTrack, sessionVisibility } = config;

  return (
    isObjectRecord(background) &&
    typeof background.opacity === 'number' &&
    (units === 'auto' || units === 'Metric' || units === 'Imperial') &&
    typeof showOnlyWhenOnTrack === 'boolean' &&
    isSessionVisibility(sessionVisibility)
  );
};

const isWindWidgetSettings = (
  widget: DashboardWidget | undefined
): widget is DashboardWidget & WindWidgetSettings =>
  widget?.id === SETTING_ID && isWindConfig(widget.config);

export const WindSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  );
  const [settings, setSettings] = useState<WindWidgetSettings>({
    enabled: isWindWidgetSettings(savedSettings)
      ? savedSettings.enabled
      : false,
    config: isWindWidgetSettings(savedSettings)
      ? savedSettings.config
      : defaultConfig,
  });

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
