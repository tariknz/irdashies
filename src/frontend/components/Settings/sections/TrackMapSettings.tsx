import { useState, useEffect, useRef } from 'react';
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

const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/apng',
  'image/bmp',
];

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

  const [imageError, setImageError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const configChangeHandlerRef = useRef<
    ((newConfig: Partial<TrackMapWidgetSettings['config']>) => void) | null
  >(null);

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
      {(handleConfigChange) => {
        configChangeHandlerRef.current = handleConfigChange;

        const handleIconFile = (file: File) => {
          if (
            !SUPPORTED_IMAGE_TYPES.includes(file.type) &&
            !file.type.startsWith('image/')
          ) {
            setImageError(
              'Unsupported format. Please use PNG, JPG, GIF, WebP, SVG, or AVIF.'
            );
            return;
          }
          setImageError(null);
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const img = new Image();
            img.onload = () => {
              configChangeHandlerRef.current?.({ playerIconDataUrl: dataUrl });
            };
            img.onerror = () => {
              setImageError(
                'Could not load image. Please use a supported format (PNG, JPG, GIF, WebP, SVG, AVIF).'
              );
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        };

        return (
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

                <SettingDivider />

                <SettingToggleRow
                  title="Sector Colors"
                  description="Color each sector based on your session performance (purple: session best, green: within 0.5%, yellow: within 1%, red: 1%+ off pace)"
                  enabled={settings.config.sectorColoring?.enabled ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({
                      sectorColoring: {
                        enabled: newValue,
                      },
                    })
                  }
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
                        enabled={
                          settings.config.turnLabels.highContrast ?? true
                        }
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
                    title="Use custom icon for player"
                    description="Replace the player circle with a custom image"
                    enabled={settings.config.playerIconEnabled ?? false}
                    onToggle={(newValue) => {
                      handleConfigChange({ playerIconEnabled: newValue });
                      setShowRemoveConfirm(false);
                      setImageError(null);
                    }}
                  />

                  {(settings.config.playerIconEnabled ?? false) && (
                    <div className="ml-4 space-y-2">
                      <div
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleIconFile(file);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="w-full border-2 border-dashed border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-slate-500 transition-colors"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleIconFile(file);
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="player-icon-input"
                        />
                        <label
                          htmlFor="player-icon-input"
                          className="block cursor-pointer"
                        >
                          {settings.config.playerIconDataUrl ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={settings.config.playerIconDataUrl}
                                alt="Player icon"
                                className="w-10 h-10 rounded object-contain bg-slate-700"
                              />
                              <span className="text-sm text-slate-300">
                                Click or drag to replace icon
                              </span>
                            </div>
                          ) : (
                            <div className="text-slate-400">
                              <p className="mb-1 text-sm">
                                Drag and drop an image here
                              </p>
                              <p className="text-xs">
                                or click to select (PNG, JPG, GIF, WebP, SVG,
                                AVIF)
                              </p>
                            </div>
                          )}
                        </label>
                      </div>

                      {imageError && (
                        <p className="text-sm text-red-400">{imageError}</p>
                      )}

                      {settings.config.playerIconDataUrl &&
                        (showRemoveConfirm ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-300">
                              Remove icon?
                            </span>
                            <button
                              onClick={() => {
                                handleConfigChange({ playerIconDataUrl: '' });
                                setShowRemoveConfirm(false);
                              }}
                              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                            >
                              Yes, remove
                            </button>
                            <button
                              onClick={() => setShowRemoveConfirm(false)}
                              className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowRemoveConfirm(true)}
                            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                          >
                            Remove icon
                          </button>
                        ))}
                    </div>
                  )}

                  <SettingDivider />

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
                          {
                            label: 'Session Position',
                            value: 'sessionPosition',
                          },
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
                  max={80}
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

                <SettingToggleRow
                  title="Use Inverted Color for the Leader"
                  description="Use an alternate color for the leader car instead of
                      class color"
                  enabled={settings.config.invertLeaderColor ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ invertLeaderColor: newValue })
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
        );
      }}
    </BaseSettingsSection>
  );
};
