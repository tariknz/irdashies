import { useStoredTab } from '../hooks/useStoredTab';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  RejoinIndicatorWidgetSettings,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingsTabBar } from '../components/SettingsTabBar';
import { SettingsSection } from '../components/SettingSection';
import { SettingProps, settingPropFor } from '../components/SettingProp';

const SETTING_ID = 'rejoin';
const SettingProp = settingPropFor(SETTING_ID);

const defaultConfig = getWidgetDefaultConfig('rejoin');

export const RejoinIndicatorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RejoinIndicatorWidgetSettings | undefined;
  const settings: RejoinIndicatorWidgetSettings = {
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as RejoinIndicatorWidgetSettings['config']) ??
      defaultConfig,
  };

  const [activeTab, setActiveTab] = useStoredTab('rejoinTab', [
    'options',
    'visibility',
  ]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Rejoin Indicator"
      description="Configure settings for the Rejoin Indicator. Note: The widget automatically hides while you're in the garage, in a pit stall, or on pit road."
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
              {/* DISPLAY TAB */}
              {activeTab === 'options' && (
                <>
                  <SettingsSection
                    title="Widget options"
                    scaleWidgetId={SETTING_ID}
                  >
                    <SettingProp path="showAtSpeed" />
                    <SettingProp path="careGap" />
                    <SettingProp path="stopGap" />
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
                </SettingsSection>
              )}
            </div>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
