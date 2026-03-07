import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  TrackMapWidgetSettings,
  SessionVisibilitySettings,
  SettingsTabType,
} from '../types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingDivider } from '../components/SettingDivider';

const SETTING_ID = 'map';

// VIR North (track 218) inside boundary path for preview
const VIR_NORTH_PATH =
  'M1253.5,706.2c-105.8,0-225.8-1.1-477.5-3.4c-0.5,0-1,0-1.5,0c-6.4,0.1-19.6,0.2-27-11.9c-1.7-2.8-3.4-7.1-5.5-14.4c-0.1-0.3-0.2-0.5-0.2-0.6c-0.4-0.3-2.9-1.6-12-1.6c-32,0-70.2,0.2-110.6,0.4c-90.3,0.5-192.7,1.1-270.9-0.4c-25.2-0.5-55.8-2.3-99.6-18.1c-16.3-5.9-41.5-14.8-61.8-22c-7.6-2.7-14.5-5.1-19.9-7.1c-1-0.3-1.9-0.7-2.7-1.1c-5.2-2.2-6.8-2.8-11,2.4c-2.2,2.7-5.4,7.3-8.5,11.7c-3.9,5.6-8,11.3-11.2,15.2c-10.9,12.9-23.5,17.4-37.5,13.4c-4.2-1.2-18.7-6.3-25.8-20.5c-3.4-6.8-6.2-18.1-0.3-33.5c10.3-27.2,25.4-54.8,50.4-92.2c13.6-20.5,27.7-36.2,66.8-65.1c18.6-13.8,53.7-39.3,71.4-51.3c12.4-8.5,31.2-8.7,45.7-0.4c2.3,1.3,4.6,2.7,6.9,4.1c3.8,2.3,7.7,4.7,10.1,5.7c6.7,3,7.8,2.6,19.5-3.7c1.6-0.8,3.2-1.7,5-2.7c7.5-4,16.3-8.5,25.6-13.3c20.6-10.6,44-22.6,58.8-31.4c5.5-3.2,12.2-7.2,18.6-15.3c17.6-22.6,41.2-31.6,53.7-35.1c16.1-4.4,36.7-7.8,68.1-0.1l5.2,1.3c35.7,8.8,80.2,19.8,114.6,25.7c5.3,0.9,13,0.6,17-3.2c3.1-2.9,4.3-8.4,3.4-16.1c-1.1-9.8-3.7-32.7,10.5-50.5c10-12.5,26.4-20,48.6-22.4c19.5-2.1,38.2-2,79.9,0.4c49.4,2.8,87,5.9,156,22.7c52.1,12.7,124.5,38.6,184.4,66.1l0.4,0.2l94.9,48.2c16.8,8.9,24.1,24.3,19.1,40.3c-1.9,5.9-5.4,26.7,27.3,44.7c0.1,0,0.3,0.2,0.7,0.4c16,9.3,102,58,221.1,102.5l4.2,1.6c27.7,10.4,54,20.3,114.6,23.6c21,1.1,73.1,3.6,102.8,1.8l0.6,0c9.2-0.6,28.3-1.8,39.3,8.6c5,4.7,7.6,11,7.6,18.3c0,7.8-2.5,14.1-7.3,18.6c-6.4,6-16.1,8.6-29.9,7.8l-0.2,0c-11.6-0.9-23.4-2.4-34.8-4.6l-0.2,0c-10-2-31.1-4.8-59.6-0.4c-35.9,5.6-85.6,15.2-138.2,25.3c-54.5,10.5-110.9,21.4-155.6,28.5l-2.4,0.4c-8.4,1.4-13.9,2.3-38.6,2.4C1320.5,706.1,1287.8,706.2,1253.5,706.2z';

const defaultConfig: TrackMapWidgetSettings['config'] = {
  enableTurnNames: false,
  showCarNumbers: true,
  displayMode: 'carNumber',
  invertTrackColors: false,
  highContrastTurns: false,
  driverCircleSize: 40,
  playerCircleSize: 40,
  trackmapFontSize: 100,
  trackLineWidth: 20,
  trackOutlineWidth: 40,
  useHighlightColor: false,
  showOnlyWhenOnTrack: false,
  styling: { isMinimalTrack: false, isMinimalCar: false },
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const migrateConfig = (
  savedConfig: unknown
): TrackMapWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;
  const savedStyling = config.styling as
    | { isMinimalTrack?: boolean; isMinimalCar?: boolean }
    | undefined;
  return {
    styling: {
      isMinimalTrack: savedStyling?.isMinimalTrack ?? false,
      isMinimalCar: savedStyling?.isMinimalCar ?? false,
    },
    enableTurnNames:
      (config.enableTurnNames as boolean) ?? defaultConfig.enableTurnNames,
    showCarNumbers:
      (config.showCarNumbers as boolean) ?? defaultConfig.showCarNumbers,
    displayMode:
      (config.displayMode as
        | 'carNumber'
        | 'sessionPosition'
        | 'livePosition') ?? defaultConfig.displayMode,
    invertTrackColors:
      (config.invertTrackColors as boolean) ?? defaultConfig.invertTrackColors,
    highContrastTurns:
      (config.highContrastTurns as boolean) ?? defaultConfig.highContrastTurns,
    driverCircleSize:
      (config.driverCircleSize as number) ?? defaultConfig.driverCircleSize,
    playerCircleSize:
      (config.playerCircleSize as number) ?? defaultConfig.playerCircleSize,
    trackmapFontSize:
      (config.trackmapFontSize as number) ?? defaultConfig.trackmapFontSize,
    trackLineWidth:
      (config.trackLineWidth as number) ?? defaultConfig.trackLineWidth,
    trackOutlineWidth:
      (config.trackOutlineWidth as number) ?? defaultConfig.trackOutlineWidth,
    useHighlightColor:
      (config.useHighlightColor as boolean) ?? defaultConfig.useHighlightColor,
    showOnlyWhenOnTrack:
      (config.showOnlyWhenOnTrack as boolean) ??
      defaultConfig.showOnlyWhenOnTrack,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
  };
};

export const TrackMapSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TrackMapWidgetSettings | undefined;
  const [settings, setSettings] = useState<TrackMapWidgetSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config: migrateConfig(savedSettings?.config),
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('trackMapTab') as SettingsTabType) || 'track'
  );

  useEffect(() => {
    localStorage.setItem('trackMapTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Track Map"
      description="Configure track map visualization settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="map"
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="track"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Track
            </TabButton>
            <TabButton
              id="drivers"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Drivers
            </TabButton>
            <TabButton
              id="visibility"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Visibility
            </TabButton>
            <TabButton
              id="styling"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Styling
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
                  onChange={(v) => handleConfigChange({ trackLineWidth: v })}
                />

                <SettingSliderRow
                  title="Track Outline Width"
                  description="Thickness of the outline around the track"
                  value={settings.config.trackOutlineWidth ?? 40}
                  units="px"
                  min={10}
                  max={80}
                  step={1}
                  onChange={(v) => handleConfigChange({ trackOutlineWidth: v })}
                />

                <SettingToggleRow
                  title="Invert Track Colors"
                  description="Swap black and white colors for the track"
                  enabled={settings.config.invertTrackColors ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ invertTrackColors: newValue })
                  }
                />

                <SettingToggleRow
                  title="Enable Turn Names"
                  description="Show turn numbers and names on the track map"
                  enabled={settings.config.enableTurnNames ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ enableTurnNames: newValue })
                  }
                />

                {settings.config.enableTurnNames && (
                  <SettingToggleRow
                    title="High Contrast Turn Names"
                    description="Use black background for turn numbers and turn names for better legibility"
                    enabled={settings.config.highContrastTurns ?? false}
                    onToggle={(newValue) =>
                      handleConfigChange({ highContrastTurns: newValue })
                    }
                  />
                )}
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
                    <SettingButtonGroupRow<
                      'carNumber' | 'sessionPosition' | 'livePosition'
                    >
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
                  onChange={(v) => handleConfigChange({ driverCircleSize: v })}
                />

                <SettingSliderRow
                  title="Player Circle Size"
                  description="Size of the circle for your car (matches curved track map scale)"
                  value={settings.config.playerCircleSize ?? 40}
                  units="px"
                  min={10}
                  max={100}
                  step={1}
                  onChange={(v) => handleConfigChange({ playerCircleSize: v })}
                />

                <SettingSliderRow
                  title="Relative Font Size"
                  description="Relative size of the font within the trackmap"
                  value={settings.config.trackmapFontSize ?? 100}
                  units="%"
                  min={50}
                  max={150}
                  step={1}
                  onChange={(v) => handleConfigChange({ trackmapFontSize: v })}
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

            {/* STYLING TAB */}
            {activeTab === 'styling' && (
              <div>
                <div className="mb-6">
                  <SettingsSection title="Driver Circles">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleConfigChange({
                            styling: {
                              ...settings.config.styling,
                              isMinimalCar: false,
                            },
                          })
                        }
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded border cursor-pointer transition-colors ${
                          !settings.config.styling?.isMinimalCar
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-transparent hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 py-1">
                          <div
                            className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white"
                            style={{
                              fontSize: '12px',
                              filter: 'drop-shadow(1px 1px 2px black)',
                            }}
                          >
                            1
                          </div>
                          <div
                            className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-white"
                            style={{
                              fontSize: '12px',
                              filter: 'drop-shadow(1px 1px 2px black)',
                            }}
                          >
                            4
                          </div>
                          <div
                            className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white"
                            style={{
                              fontSize: '12px',
                              filter: 'drop-shadow(1px 1px 2px black)',
                            }}
                          >
                            7
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfigChange({
                            styling: {
                              ...settings.config.styling,
                              isMinimalCar: true,
                            },
                          })
                        }
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded border cursor-pointer transition-colors ${
                          settings.config.styling?.isMinimalCar
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-transparent hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 py-1">
                          <div
                            className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white"
                            style={{ fontSize: '12px' }}
                          >
                            1
                          </div>
                          <div
                            className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-white"
                            style={{ fontSize: '12px' }}
                          >
                            4
                          </div>
                          <div
                            className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white"
                            style={{ fontSize: '12px' }}
                          >
                            7
                          </div>
                        </div>
                      </button>
                    </div>
                  </SettingsSection>
                </div>
                <div className="mb-6">
                  <SettingsSection title="Track">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleConfigChange({
                            styling: {
                              ...settings.config.styling,
                              isMinimalTrack: false,
                            },
                          })
                        }
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded border cursor-pointer transition-colors ${
                          !settings.config.styling?.isMinimalTrack
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-transparent hover:bg-slate-800'
                        }`}
                      >
                        <svg
                          viewBox="60 240 1770 475"
                          width="200"
                          height="54"
                          style={{ filter: 'drop-shadow(1px 1px 2px black)' }}
                        >
                          <path
                            d={VIR_NORTH_PATH}
                            fill="none"
                            stroke="black"
                            strokeWidth="32"
                          />
                          <path
                            d={VIR_NORTH_PATH}
                            fill="none"
                            stroke="white"
                            strokeWidth="18"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfigChange({
                            styling: {
                              ...settings.config.styling,
                              isMinimalTrack: true,
                            },
                          })
                        }
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded border cursor-pointer transition-colors ${
                          settings.config.styling?.isMinimalTrack
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-transparent hover:bg-slate-800'
                        }`}
                      >
                        <svg viewBox="60 240 1770 475" width="200" height="54">
                          <path
                            d={VIR_NORTH_PATH}
                            fill="none"
                            stroke="black"
                            strokeWidth="32"
                          />
                          <path
                            d={VIR_NORTH_PATH}
                            fill="none"
                            stroke="white"
                            strokeWidth="18"
                          />
                        </svg>
                      </button>
                    </div>
                  </SettingsSection>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
