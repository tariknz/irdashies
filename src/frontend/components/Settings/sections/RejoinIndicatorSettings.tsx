import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  RejoinIndicatorWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingNumberRow } from '../components/SettingNumberRow';

const SETTING_ID = 'rejoin';

const defaultConfig = getWidgetDefaultConfig('rejoin');

export const RejoinIndicatorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RejoinIndicatorWidgetSettings | undefined;
  const [settings, setSettings] = useState<RejoinIndicatorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as RejoinIndicatorWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('rejoinTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('rejoinTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Rejoin Indicator"
      description="Configure settings for the Rejoin Indicator. Note: The widget automatically hides while you're in the garage, in a pit stall, or on pit road."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
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
            {/* DISPLAY TAB */}
            {activeTab === 'options' && (
              <SettingsSection title="Options">
                <SettingNumberRow
                  title="Show At Speed"
                  description="Display the rejoin indicator widget when you are at or below this
                    speed"
                  value={settings.config.showAtSpeed}
                  min={0}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ showAtSpeed: v })}
                />

                <SettingNumberRow
                  title="Care Gap"
                  description="Distance to the car behind where you need to be cautious when
                    rejoining. Note: the clear status will show when next car is above
                    this gap"
                  value={settings.config.careGap}
                  min={0}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ careGap: v })}
                />

                <SettingNumberRow
                  title="Stop Gap"
                  description="Distance to the car behind where it is not safe to rejoin"
                  value={settings.config.stopGap}
                  min={0}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ stopGap: v })}
                />
              </SettingsSection>
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
      )}
    </BaseSettingsSection>
  );
};
