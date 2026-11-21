import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  getWidgetManifest,
  isConfigValid,
  type DamageWidgetSettings,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import { SettingsSection } from '../components/SettingSection';

const SETTING_ID = 'damage';
const SettingProp = settingPropFor(SETTING_ID);
const defaultConfig = getWidgetDefaultConfig(SETTING_ID);
const properties = getWidgetManifest(SETTING_ID)?.properties ?? {};

const withDefaults = (config: unknown) =>
  deepMergeConfig(
    defaultConfig as unknown as Record<string, unknown>,
    config
  ) as unknown as DamageWidgetSettings['config'];

export const DamageSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  );
  const savedConfig = savedSettings && withDefaults(savedSettings.config);
  const settings: DamageWidgetSettings =
    savedSettings && savedConfig && isConfigValid(properties, savedConfig)
      ? { enabled: savedSettings.enabled, config: savedConfig }
      : { enabled: false, config: defaultConfig };

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Damage"
      description="Top-down damage silhouette matched to your car class (GT, prototype, open-wheel, hatch, stock, truck). LMU: panel dents. iRacing: repair flags and tyre wear."
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
            <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
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
