import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  CornerNameWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'cornername';

const defaultConfig = getWidgetDefaultConfig('cornername');

export const CornerNameSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as CornerNameWidgetSettings | undefined;

  const [settings, setSettings] = useState<CornerNameWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as CornerNameWidgetSettings['config']) ??
      defaultConfig,
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('cornerNameTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('cornerNameTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Corner Names"
      description="Displays the current track section name, corner number, and progress through the section. Track data sourced from lovely-track-data."
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
            <div className="flex border-b border-slate-700/50">
              <TabButton
                id="display"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Display
              </TabButton>
              <TabButton
                id="styling"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Appearance
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
              {activeTab === 'display' && (
                <SettingsSection title="Elements">
                  <SettingProp path="showCornerNumber" />
                  <SettingProp path="showProgressBar" />
                  <SettingProp path="showTrackPct" />
                </SettingsSection>
              )}

              {activeTab === 'styling' && (
                <SettingsSection title="Appearance">
                  <SettingProp path="fontSize" />

                  <SettingSliderRow
                    title="Opacity"
                    description="Background opacity of the overlay"
                    value={Math.round(settings.config.opacity * 100)}
                    units="%"
                    min={20}
                    max={100}
                    step={5}
                    onChange={(v) => handleConfigChange({ opacity: v / 100 })}
                  />
                </SettingsSection>
              )}

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
