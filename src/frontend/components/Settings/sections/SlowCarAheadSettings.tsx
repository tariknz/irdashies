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
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingSliderRow } from '../components/SettingSliderRow';

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

          <div className="pt-4">
            {/* OPTIONS TAB */}
            {activeTab === 'options' && (
              <SettingsSection title="Display">
                <SettingNumberRow
                  title="Maximum Distance (m)"
                  description="The maximum distance the slow car can be for the widget to be visible."
                  value={settings.config.maxDistance}
                  min={100}
                  max={999}
                  step={1}
                  onChange={(v) => handleConfigChange({ maxDistance: v })}
                />

                <SettingNumberRow
                  title="Slow Speed Threshold (km/h)"
                  description="The threshold for when a car is considered slow, and the widget will appear."
                  value={settings.config.slowSpeedThreshold}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ slowSpeedThreshold: v })
                  }
                />

                <SettingNumberRow
                  title="Stopped Speed Threshold (km/h)"
                  description="The threshold for when a car is considered stopped, and the bar will turn red."
                  value={settings.config.stoppedSpeedThreshold}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ stoppedSpeedThreshold: v })
                  }
                />

                <SettingSliderRow
                  title="Bar Thickness"
                  description="The thickness of the colored bar of the widget (px)."
                  value={settings.config.barThickness}
                  units="px"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => handleConfigChange({ barThickness: v })}
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

                <SettingDivider />

                <SettingToggleRow
                  title="Show only when on track"
                  description="If enabled, widget will only be shown when driving"
                  enabled={settings.config.showOnlyWhenOnTrack ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showOnlyWhenOnTrack: newValue })
                  }
                />
              </SettingsSection>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
