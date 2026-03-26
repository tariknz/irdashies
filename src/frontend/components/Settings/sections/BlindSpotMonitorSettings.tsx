import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  BlindSpotMonitorWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { HIGHLIGHT_COLOR_PRESETS } from './GeneralSettings';

const SETTING_ID = 'blindspotmonitor';

const defaultConfig = getWidgetDefaultConfig('blindspotmonitor');

export const BlindSpotMonitorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BlindSpotMonitorWidgetSettings | undefined;
  const [settings, setSettings] = useState<BlindSpotMonitorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as BlindSpotMonitorWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('bsmTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('bsmTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Blind Spot Monitor"
      description="Configure settings for the blind spot monitor widget that displays visual indicators when cars are detected on your left or right side."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
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

          <div className="pt-4">
            {/* DISPLAY TAB */}
            {activeTab === 'display' && (
              <SettingsSection title="Display">
                {/* Background Opacity */}
                <SettingSliderRow
                  title="Background Opacity"
                  value={settings.config.background?.opacity ?? 30}
                  units="%"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({ background: { opacity: v } })
                  }
                />

                {/* Width */}
                <SettingSliderRow
                  title="Width"
                  description="Width of the blind spot indicator in pixels."
                  value={settings.config.width ?? 20}
                  units="px"
                  min={5}
                  max={100}
                  step={1}
                  onChange={(v) => handleConfigChange({ width: v })}
                />

                {/* Border Size */}
                <SettingSliderRow
                  title="Border Size"
                  description="Border thickness of the blind spot indicator in pixels."
                  value={settings.config.borderSize ?? 1}
                  units="px"
                  min={0}
                  max={20}
                  step={1}
                  onChange={(v) => handleConfigChange({ borderSize: v })}
                />

                {/* Indicator Color */}
                <div className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Indicator Color
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded border-2"
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: `#${(settings.config.indicatorColor ?? 16096779).toString(16).padStart(6, '0')}`,
                        borderColor: `#${(settings.config.indicatorColor ?? 16096779).toString(16).padStart(6, '0')}`,
                      }}
                    />
                    <select
                      value={settings.config.indicatorColor ?? 16096779}
                      onChange={(e) =>
                        handleConfigChange({
                          indicatorColor: parseInt(e.target.value),
                        })
                      }
                      className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    >
                      {Array.from(HIGHLIGHT_COLOR_PRESETS.entries()).map(
                        ([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              </SettingsSection>
            )}

            {/* OPTIONS TAB */}
            {activeTab === 'options' && (
              <SettingsSection title="Options">
                {/* Distance Ahead */}
                <SettingSliderRow
                  title="Distance Ahead"
                  description="Distance to car ahead in meters."
                  value={settings.config.distAhead ?? 20}
                  units="m"
                  min={3}
                  max={6}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ distAhead: v })}
                />

                {/* Distance Behind */}
                <SettingSliderRow
                  title="Distance Behind"
                  description="Distance to car behind in meters."
                  value={settings.config.distBehind ?? 20}
                  units="m"
                  min={3}
                  max={6}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ distBehind: v })}
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
                  description="If enabled, blind spotter will only be shown when driving"
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
