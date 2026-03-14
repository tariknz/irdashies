import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  TrackMapWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingDivider } from '../components/SettingDivider';

const SETTING_ID = 'map';

// Simplified SVG path of VIR North circuit for track style preview
const VIR_NORTH_PATH =
  'M 200,450 C 250,350 350,280 500,260 C 650,240 900,250 1100,280 ' +
  'C 1300,310 1500,360 1650,400 C 1750,430 1810,490 1780,560 ' +
  'C 1750,630 1650,670 1500,680 C 1350,690 1100,700 900,690 ' +
  'C 700,680 500,660 350,620 C 220,590 150,530 200,450 Z';

const defaultConfig = getWidgetDefaultConfig('map');

export const TrackMapSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TrackMapWidgetSettings | undefined;
  const [settings, setSettings] = useState<TrackMapWidgetSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config:
      (savedSettings?.config as TrackMapWidgetSettings['config']) ??
      defaultConfig,
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
                      value={settings.config.displayMode ?? 'carNumber'}
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
