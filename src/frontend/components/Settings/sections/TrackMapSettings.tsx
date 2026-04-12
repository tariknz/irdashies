import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  TrackMapWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard, useSectorTimingStore } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingActionButton } from '../components/SettingActionButton';
import { ConfirmDialog } from '../components/ConfirmDialog';

const SETTING_ID = 'map';

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

  const clearAllTimeBests = useSectorTimingStore((s) => s.clearAllTimeBests);
  const resetSectorTiming = useSectorTimingStore((s) => s.reset);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearCurrentConfirm, setShowClearCurrentConfirm] = useState(false);

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
              id="styling"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Styling
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

                <SettingDivider />

                <SettingToggleRow
                  title="Sector Colors"
                  description="Color each sector based on your lap time performance (purple: PB, green: session best, yellow: near best, red: slower)"
                  enabled={settings.config.sectorColoring?.enabled ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({
                      sectorColoring: {
                        ...(settings.config.sectorColoring ?? {
                          comparison: 'sessionBest',
                        }),
                        enabled: newValue,
                      },
                    })
                  }
                />

                {settings.config.sectorColoring?.enabled && (
                  <SettingsSection>
                    <SettingButtonGroupRow<'sessionBest' | 'allTimeBest'>
                      title="Best Comparison"
                      value={
                        settings.config.sectorColoring.comparison ??
                        'sessionBest'
                      }
                      options={[
                        { label: 'Session Best', value: 'sessionBest' },
                        { label: 'All-Time Best', value: 'allTimeBest' },
                      ]}
                      onChange={(v) =>
                        handleConfigChange({
                          sectorColoring: {
                            enabled: true,
                            ...settings.config.sectorColoring,
                            comparison: v,
                          },
                        })
                      }
                    />
                    <SettingActionButton
                      label="Clear All"
                      onClick={() => setShowClearConfirm(true)}
                    />
                    <SettingActionButton
                      label="Clear Current Car/Track"
                      onClick={() => setShowClearCurrentConfirm(true)}
                    />
                  </SettingsSection>
                )}

                <ConfirmDialog
                  isOpen={showClearConfirm}
                  title="Clear All Sector Data"
                  message="This will clear all all-time best sector times for the current track. Session bests for this session will be kept. Are you sure?"
                  confirmText="Clear"
                  cancelText="Cancel"
                  variant="warning"
                  onConfirm={() => {
                    clearAllTimeBests();
                    setShowClearConfirm(false);
                  }}
                  onCancel={() => setShowClearConfirm(false)}
                />

                <ConfirmDialog
                  isOpen={showClearCurrentConfirm}
                  title="Clear Current Car/Track"
                  message="This will reset all sector timing data for the current car and track, including session bests and all-time bests. Are you sure?"
                  confirmText="Clear"
                  cancelText="Cancel"
                  variant="warning"
                  onConfirm={() => {
                    resetSectorTiming();
                    setShowClearCurrentConfirm(false);
                  }}
                  onCancel={() => setShowClearCurrentConfirm(false)}
                />

                <SettingDivider />

                <SettingToggleRow
                  title="Enable Turn Labels"
                  description="Show turn numbers and names on the track map"
                  enabled={settings.config.turnLabels?.enabled ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({
                      turnLabels: {
                        ...(settings.config.turnLabels ?? {}),
                        enabled: newValue,
                      },
                    })
                  }
                />

                {settings.config.turnLabels?.enabled && (
                  <SettingsSection>
                    <SettingButtonGroupRow<'numbers' | 'names' | 'both'>
                      title="Display Mode"
                      value={settings.config.turnLabels.labelType ?? 'both'}
                      options={[
                        { label: 'Numbers', value: 'numbers' },
                        { label: 'Names', value: 'names' },
                        { label: 'Both', value: 'both' },
                      ]}
                      onChange={(v) =>
                        handleConfigChange({
                          turnLabels: {
                            ...settings.config.turnLabels,
                            labelType: v,
                          },
                        })
                      }
                    />

                    <SettingToggleRow
                      title="High Contrast Labels"
                      description="Use black background for turn numbers and turn names for better legibility"
                      enabled={settings.config.turnLabels.highContrast ?? true}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          turnLabels: {
                            ...settings.config.turnLabels,
                            highContrast: newValue,
                          },
                        })
                      }
                    />

                    <SettingSliderRow
                      title="Relative Label Size"
                      description="Relative font size of the turn labels"
                      value={settings.config.turnLabels.labelFontSize ?? 100}
                      units="%"
                      min={50}
                      max={300}
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({
                          turnLabels: {
                            ...settings.config.turnLabels,
                            labelFontSize: v,
                          },
                        })
                      }
                    />
                  </SettingsSection>
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

            {/* STYLING TAB */}
            {activeTab === 'styling' && (
              <SettingsSection title="Minimal Styling">
                <SettingToggleRow
                  title="Minimal Track"
                  description="Remove the drop shadow from the track"
                  enabled={settings.config.styling?.isMinimalTrack ?? true}
                  onToggle={(newValue) =>
                    handleConfigChange({
                      styling: {
                        ...settings.config.styling,
                        isMinimalTrack: newValue,
                      },
                    })
                  }
                />
                <SettingToggleRow
                  title="Minimal Car Markers"
                  description="Remove the drop shadow from the car markers"
                  enabled={settings.config.styling?.isMinimalCar ?? true}
                  onToggle={(newValue) =>
                    handleConfigChange({
                      styling: {
                        ...settings.config.styling,
                        isMinimalCar: newValue,
                      },
                    })
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
