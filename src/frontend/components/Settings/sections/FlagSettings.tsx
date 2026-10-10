import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  FlagWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'flag';

const defaultConfig = getWidgetDefaultConfig('flag');

export const FlagSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as FlagWidgetSettings | undefined;

  const [settings, setSettings] = useState<FlagWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as FlagWidgetSettings['config']) ?? defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('flagTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('flagTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Flag"
      description="Display track flags"
      settings={settings as FlagWidgetSettings}
      onSettingsChange={(s) => setSettings(s as FlagWidgetSettings)}
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
                  <SettingProp path="background.opacity" />

                  <SettingProp path="doubleFlag" />

                  <SettingProp path="matrixMode" />

                  <SettingProp path="animate" />

                  <SettingProp path="blinkPeriod" />

                  <SettingProp path="showLabel" />

                  <SettingProp path="showNoFlagState" />

                  <SettingProp path="enableGlow" />
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
