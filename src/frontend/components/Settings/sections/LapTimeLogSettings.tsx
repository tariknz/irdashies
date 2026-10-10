import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  LapTimeLogWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'laptimelog';

const defaultConfig = getWidgetDefaultConfig('laptimelog');

export const LapTimeLogSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as LapTimeLogWidgetSettings | undefined;
  const [settings, setSettings] = useState<LapTimeLogWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as LapTimeLogWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('lapTimeTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('lapTimeTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Lap Timer"
      description="Configure settings for the Lap Timer widget. Select the lap times you want to see and the display options."
      settings={settings}
      onSettingsChange={setSettings}
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
            <div className="flex border-b border-slate-700/50">
              <TabButton
                id="display"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Display
              </TabButton>
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
            </div>

            <div>
              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <>
                  <SettingsSection title="Display">
                    <SettingProp path="showCurrentLap" />

                    <SettingProp path="showPredictedLap" />

                    <SettingProp path="showLastLap" />

                    <SettingProp path="showBestLap" />

                    <SettingProp path="showAllTimeLap" />

                    <SettingProp path="delta.enabled" />

                    {settings.config.delta?.enabled && (
                      <SettingsSection>
                        <SettingProp path="delta.method" />
                      </SettingsSection>
                    )}

                    <SettingProp path="history.enabled" />

                    {settings.config.history?.enabled && (
                      <SettingsSection>
                        <SettingProp path="history.style" />

                        <SettingProp path="history.count" />

                        <SettingProp path="history.hidePittedLaps" />
                      </SettingsSection>
                    )}
                  </SettingsSection>
                </>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <SettingsSection title="Options">
                  {/* Background Opacity */}
                  <SettingProp path="background.opacity" />

                  {/* Foreground Opacity */}
                  <SettingProp path="foreground.opacity" />

                  {/* Scale */}
                  <SettingProp path="scale" />

                  <SettingProp path="reverse" />

                  <SettingProp path="alignment" />
                </SettingsSection>
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
