import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  CornerNameWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';

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

  const [activeTab, setActiveTab] = useState<SettingsTabType>(() => {
    const savedTab = localStorage.getItem(
      'cornerNameTab'
    ) as SettingsTabType | null;
    return savedTab === 'styling' ? 'options' : savedTab || 'display';
  });

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
      activeSettingsTab={activeTab}
    >
      {(handleConfigChange) => (
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
            {activeTab === 'display' && (
              <SettingsSection title="Elements">
                <SettingToggleRow
                  title="Show Corner Number"
                  description="Display the corner number badge (e.g. T1, T3)"
                  enabled={settings.config.showCornerNumber}
                  onToggle={(v) => handleConfigChange({ showCornerNumber: v })}
                />

                <SettingToggleRow
                  title="Show Progress Bar"
                  description="Display progress through the current section"
                  enabled={settings.config.showProgressBar}
                  onToggle={(v) => handleConfigChange({ showProgressBar: v })}
                />

                <SettingToggleRow
                  title="Show Track Percentage"
                  description="Display overall track position percentage"
                  enabled={settings.config.showTrackPct}
                  onToggle={(v) => handleConfigChange({ showTrackPct: v })}
                />
              </SettingsSection>
            )}

            {activeTab === 'options' && (
              <SettingsSection title="Options">
                <SettingNumberRow
                  title="Font Size"
                  description="Base font size for corner names (px)"
                  value={settings.config.fontSize}
                  min={12}
                  max={32}
                  step={1}
                  onChange={(v) => handleConfigChange({ fontSize: v })}
                />

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
      )}
    </BaseSettingsSection>
  );
};
