import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  getWidgetManifest,
  isConfigValid,
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

const properties = getWidgetManifest(SETTING_ID)?.properties ?? {};

export const WindSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  );
  const savedConfig = savedSettings && withDefaults(savedSettings.config);
  const settings: WindWidgetSettings =
    savedSettings && savedConfig && isConfigValid(properties, savedConfig)
      ? { enabled: savedSettings.enabled, config: savedConfig }
      : { enabled: false, config: defaultConfig };

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Wind"
      description="Show wind direction and speed."
      settings={settings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <div className="space-y-4">
            <SettingsSection title="Widget options" scaleWidgetId={SETTING_ID}>
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
