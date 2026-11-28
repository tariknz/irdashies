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
import { SettingsTabBar } from '../components/SettingsTabBar';
import { TabButton } from '../components/TabButton';
import { useStoredTab } from '../hooks/useStoredTab';

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
  const [activeTab, setActiveTab] = useStoredTab('damageTab', [
    'display',
    'visibility',
  ]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Damage"
      description="Top-down chassis schematic with wheels and suspension markers. Damaged areas turn yellow/red and show remaining % when enabled. Engine warnings appear as side icons."
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
            <SettingsTabBar>
              <TabButton
                id="display"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Display
              </TabButton>
              <TabButton
                id="visibility"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Visibility
              </TabButton>
            </SettingsTabBar>

            {activeTab === 'display' && (
              <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
                <SettingProp path="background.opacity" />
                <SettingProp path="showIntegrity" />
                <SettingProp path="showStats" />
                <SettingProp path="showTyreWear" />
                <SettingProp path="showCornerBadges" />
                {settings.config.showCornerBadges && (
                  <div className="pl-8 mt-2">
                    <SettingProp path="showCornerPct" />
                  </div>
                )}
              </SettingsSection>
            )}

            {activeTab === 'visibility' && (
              <SettingsSection title="Visibility">
                <SessionVisibility
                  sessionVisibility={settings.config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />
                <SettingDivider />
                <SettingProp path="showOnlyWhenOnTrack" />
                <SettingProp path="showOnlyWhenDamaged" />
              </SettingsSection>
            )}
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
