import { useStoredTab } from '../hooks/useStoredTab';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { FlagWidgetSettings, getWidgetDefaultConfig } from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SettingsTabBar } from '../components/SettingsTabBar';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProps, settingPropFor } from '../components/SettingProp';

const SETTING_ID = 'flag';
const SettingProp = settingPropFor(SETTING_ID);

const defaultConfig = getWidgetDefaultConfig('flag');

export const FlagSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as FlagWidgetSettings | undefined;

  const settings: FlagWidgetSettings = {
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as FlagWidgetSettings['config']) ?? defaultConfig,
  };

  const [activeTab, setActiveTab] = useStoredTab('flagTab', [
    'options',
    'visibility',
  ]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Flag"
      description="Display track flags"
      settings={settings as FlagWidgetSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <div className="space-y-4">
            {/* Tabs */}
            <SettingsTabBar>
              <TabButton
                id="options"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Options
              </TabButton>
              <TabButton
                id="visibility"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Visibility
              </TabButton>
            </SettingsTabBar>

            <div>
              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <>
                  <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
                    <SettingProp path="background.opacity" />

                    <SettingProp path="doubleFlag" />

                    <SettingProp path="matrixMode" />

                    <SettingProp path="animate" />

                    <SettingProp path="blinkPeriod" />

                    <SettingProp path="showLabel" />

                    <SettingProp path="showNoFlagState" />

                    <SettingProp path="enableGlow" />
                  </SettingsSection>
                </>
              )}

              {/* VISIBILITY TAB */}
              {activeTab === 'visibility' && (
                <SettingsSection title="Session Visibility">
                  <SessionVisibility
                    sessionVisibility={settings.config.sessionVisibility}
                    handleConfigChange={handleConfigChange}
                  />

                  <SettingDivider />

                  <SettingProp path="showOnlyWhenOnTrack" />
                </SettingsSection>
              )}
            </div>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
