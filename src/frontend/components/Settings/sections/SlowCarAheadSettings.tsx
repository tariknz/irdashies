import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  SlowCarAheadWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'slowcarahead';

const defaultConfig = getWidgetDefaultConfig('slowcarahead');

export const SlowCarAheadSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as SlowCarAheadWidgetSettings | undefined;

  const [settings, setSettings] = useState<SlowCarAheadWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as SlowCarAheadWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('slowCarAheadTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('slowCarAheadTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Slow Car Ahead"
      description="Display indicator for slow cars ahead"
      settings={settings as SlowCarAheadWidgetSettings}
      onSettingsChange={(s) => setSettings(s as SlowCarAheadWidgetSettings)}
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
              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <SettingsSection title="Display">
                  <SettingProp path="maxDistance" />
                  <SettingProp path="slowSpeedThreshold" />
                  <SettingProp path="stoppedSpeedThreshold" />
                  <SettingProp path="barThickness" />
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
