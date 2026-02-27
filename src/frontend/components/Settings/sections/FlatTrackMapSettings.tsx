import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { FlatTrackMapWidgetSettings, SessionVisibilitySettings, SettingsTabType } from '../types';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingDivider } from '../components/SettingDivider';

const SETTING_ID = 'flatmap';

const defaultConfig: FlatTrackMapWidgetSettings['config'] = {
  showCarNumbers: true,
  displayMode: 'carNumber',
  driverCircleSize: 40,
  playerCircleSize: 40,
  trackmapFontSize: 100,
  trackLineWidth: 20,
  trackOutlineWidth: 40,
  invertTrackColors: false,
  useHighlightColor: false,
  showOnlyWhenOnTrack: false,
  sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true }
};

const migrateConfig = (savedConfig: unknown): FlatTrackMapWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;
  return {
    showCarNumbers: (config.showCarNumbers as boolean) ?? defaultConfig.showCarNumbers,
    displayMode: (config.displayMode as 'carNumber' | 'sessionPosition') ?? defaultConfig.displayMode,
    driverCircleSize: (config.driverCircleSize as number) ?? defaultConfig.driverCircleSize,
    playerCircleSize: (config.playerCircleSize as number) ?? defaultConfig.playerCircleSize,
    trackmapFontSize: (config.trackmapFontSize as number) ?? defaultConfig.trackmapFontSize,
    trackLineWidth: (config.trackLineWidth as number) ?? defaultConfig.trackLineWidth,
    trackOutlineWidth: (config.trackOutlineWidth as number) ?? defaultConfig.trackOutlineWidth,
    invertTrackColors: (config.invertTrackColors as boolean) ?? defaultConfig.invertTrackColors,
    useHighlightColor: (config.useHighlightColor as boolean) ?? defaultConfig.useHighlightColor,
    showOnlyWhenOnTrack: (config.showOnlyWhenOnTrack as boolean) ?? defaultConfig.showOnlyWhenOnTrack,
    sessionVisibility: (config.sessionVisibility as SessionVisibilitySettings) ?? defaultConfig.sessionVisibility,
  };
};

export const FlatTrackMapSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find((w) => w.id === SETTING_ID) as FlatTrackMapWidgetSettings | undefined;
  const [settings, setSettings] = useState<FlatTrackMapWidgetSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config: migrateConfig(savedSettings?.config),
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('flatTrackMapTab') as SettingsTabType) || 'track'
  );

  useEffect(() => {
    localStorage.setItem('flatTrackMapTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Flat Track Map"
      description="Configure flat track map visualization settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="flatmap"
    >
      {(handleConfigChange) => (
        <div className="space-y-4">

          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton id="track" activeTab={activeTab} setActiveTab={setActiveTab}>
              Track
            </TabButton>
            <TabButton id="drivers" activeTab={activeTab} setActiveTab={setActiveTab}>
              Drivers
            </TabButton>
            <TabButton id="visibility" activeTab={activeTab} setActiveTab={setActiveTab}>
              Visibility
            </TabButton>
          </div>

          <div className="pt-4">

            {/* TRACK TAB */}
            {activeTab === 'track' && (
              <SettingsSection title="Track Settings">

                <SettingSliderRow
                  title="Track Line Width"
                  description="Thickness of the track line (matches curved track map scale)"
                  value={settings.config.trackLineWidth ?? 20}
                  units="px"
                  min={5}
                  max={40}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ trackLineWidth: v })
                  }
                />

                <SettingSliderRow
                  title="Track Outline Width"
                  description="Thickness of the outline around the track"
                  value={settings.config.trackOutlineWidth ?? 40}
                  units="px"
                  min={10}
                  max={80}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ trackOutlineWidth: v })
                  }
                />

                <SettingToggleRow
                  title="Invert Track Colors"
                  description="Swap black and white colors for the track"
                  enabled={settings.config.invertTrackColors ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ invertTrackColors: newValue })
                  }
                />

              </SettingsSection>
            )}

            {/* DRIVERS TAB */}
            {activeTab === 'drivers' && (
              <SettingsSection title="Driver Circles">
  
                <SettingToggleRow
                  title="Show Car Numbers"
                  description="Display car numbers on driver circles"
                  enabled={settings.config.showCarNumbers ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showCarNumbers: newValue })
                  }
                />

                {settings.config.showCarNumbers && (
                  <SettingsSection>
                    <SettingButtonGroupRow<'carNumber' | 'sessionPosition' | 'livePosition'>
                      title="Display Mode"
                      value={settings.config.displayMode}
                      options={[
                        { label: 'Car Number', value: 'carNumber' },
                        { label: 'Session Position', value: 'sessionPosition' },
                        { label: 'Live Position', value: 'livePosition' },
                      ]}
                      onChange={(v) => handleConfigChange({ displayMode: v })}
                    />      
                  </SettingsSection>            
                )}

                <SettingSliderRow
                  title="Driver Circle Size"
                  description="Size of the circle for other drivers (matches curved track map scale)"
                  value={settings.config.driverCircleSize ?? 40}
                  units="px"
                  min={10}
                  max={80}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ driverCircleSize: v })
                  }
                />

                <SettingSliderRow
                  title="Player Circle Size"
                  description="Size of the circle for your car (matches curved track map scale)"
                  value={settings.config.playerCircleSize ?? 40}
                  units="px"
                  min={10}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ playerCircleSize: v })
                  }
                />

                <SettingSliderRow
                  title="Relative Font Size"
                  description="Relative size of the font within the trackmap"
                  value={settings.config.trackmapFontSize ?? 100}
                  units="%"
                  min={50}
                  max={150}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ trackmapFontSize: v })
                  }
                />

                <SettingToggleRow
                  title="Use Highlight Color for Player"
                  description="Use your custom highlight color for the player car instead of
                      class color"
                  enabled={settings.config.useHighlightColor ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ useHighlightColor: newValue })
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
                  description="If enabled, track map will only be shown when driving"
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