import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  BlindSpotMonitorWidgetSettings,
  SessionVisibilitySettings,
  SettingsTabType,
} from '../types';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingToggleRow } from '../components/SettingToggleRow';

const SETTING_ID = 'blindspotmonitor';

const defaultConfig: BlindSpotMonitorWidgetSettings['config'] = {
  showOnlyWhenOnTrack: true,
  distAhead: 4,
  distBehind: 4,
  background: {
    opacity: 30,
  },
  width: 20,
  sessionVisibility: {
    race: true,
    loneQualify: false,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const migrateConfig = (
  savedConfig: unknown
): BlindSpotMonitorWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;
  return {
    showOnlyWhenOnTrack:
      (config.showOnlyWhenOnTrack as boolean) ??
      defaultConfig.showOnlyWhenOnTrack,
    distAhead: (config.distAhead as number) ?? defaultConfig.distAhead,
    distBehind: (config.distBehind as number) ?? defaultConfig.distBehind,
    background: {
      opacity:
        (config.background as { opacity?: number })?.opacity ??
        (defaultConfig.background?.opacity as number),
    },
    width: (config.width as number) ?? defaultConfig.width,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
  };
};

export const BlindSpotMonitorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BlindSpotMonitorWidgetSettings | undefined;
  const [settings, setSettings] = useState<BlindSpotMonitorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
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
                    onChange={(v) =>
                      handleConfigChange({ width: v })
                    }
                  />

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
                    onChange={(v) =>
                      handleConfigChange({ distAhead: v })
                    }
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
                    onChange={(v) =>
                      handleConfigChange({ distBehind: v })
                    }
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
