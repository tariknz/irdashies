import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { FlatTrackMapWidgetSettings, SessionVisibilitySettings } from '../types';
import { SessionVisibility } from '../components/SessionVisibility';

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
          
          {/* Track Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-200">Track</h3>   
            <div className="pl-4 space-y-4">  

              <div className="space-y-2">
                <label className="text-slate-300">
                  Track Line Width: {settings.config.trackLineWidth ?? 20}px
                </label>
                <input
                  type="range"
                  min="5"
                  max="40"
                  step="1"
                  value={settings.config.trackLineWidth ?? 20}
                  onChange={(e) =>
                    handleConfigChange({
                      trackLineWidth: parseInt(e.target.value) || 20,
                    })
                  }
                  className="w-full"
                />
                <p className="text-slate-500 text-xs">
                  Thickness of the track line (matches curved track map scale)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300">
                  Track Outline Width: {settings.config.trackOutlineWidth ?? 40}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="1"
                  value={settings.config.trackOutlineWidth ?? 40}
                  onChange={(e) =>
                    handleConfigChange({
                      trackOutlineWidth: parseInt(e.target.value) || 40,
                    })
                  }
                  className="w-full"
                />
                <p className="text-slate-500 text-xs">
                  Thickness of the outline around the track
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">Invert Track Colors</span>
                  <p className="text-xs text-slate-500">
                    Swap black and white colors for the track
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.config.invertTrackColors ?? false}
                  onToggle={(enabled) =>
                    handleConfigChange({
                      invertTrackColors: enabled,
                    })
                  }
                />
              </div>

            </div>
          </div>

          {/* Driver Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-200">Drivers</h3>   
            <div className="pl-4 space-y-4">  

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">Show Car Numbers</span>
                  <p className="text-xs text-slate-500">
                    Display car numbers on driver circles
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.config.showCarNumbers ?? true}
                  onToggle={(enabled) =>
                    handleConfigChange({
                      showCarNumbers: enabled,
                    })
                  }
                />
              </div>

              {settings.config.showCarNumbers && (
              <div className="flex items-center justify-between pl-4">
                <span className="text-sm text-slate-300">Display Mode</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfigChange({ displayMode: 'carNumber' })}
                    className={`px-3 py-1 rounded text-sm transition-colors ${settings.config.displayMode === 'carNumber'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                  >
                    Car Number
                  </button>
                  <button
                    onClick={() => handleConfigChange({ displayMode: 'sessionPosition' })}
                    className={`px-3 py-1 rounded text-sm transition-colors ${settings.config.displayMode === 'sessionPosition'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                  >
                    Session Position
                  </button>
                  <button
                    onClick={() => handleConfigChange({ displayMode: 'livePosition' })}
                    className={`px-3 py-1 rounded text-sm transition-colors ${settings.config.displayMode === 'livePosition'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                  >
                    Live Position
                  </button>
                </div>
              </div>
              )}

              <div className="space-y-2">
                <label className="text-slate-300">
                  Driver Circle Size: {settings.config.driverCircleSize ?? 40}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="1"
                  value={settings.config.driverCircleSize ?? 40}
                  onChange={(e) =>
                    handleConfigChange({
                      driverCircleSize: parseInt(e.target.value) || 40,
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-slate-500">
                  Size of the circle for other drivers (matches curved track map scale)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300">
                  Player Circle Size: {settings.config.playerCircleSize ?? 40}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={settings.config.playerCircleSize ?? 40}
                  onChange={(e) =>
                    handleConfigChange({
                      playerCircleSize: parseInt(e.target.value) || 40,
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-slate-500">
                  Size of the circle for your car (matches curved track map scale)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300">
                  Relative Font Size: {settings.config.trackmapFontSize ?? 100}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                  value={settings.config.trackmapFontSize ?? 100}
                  onChange={(e) =>
                    handleConfigChange({
                      trackmapFontSize: parseInt(e.target.value) || 100,
                    })
                  }
                  className="w-full"
                />
                <p className="text-slate-500 text-xs">
                  Relative size of the font within the trackmap
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">
                    Use Highlight Color for Player
                  </span>
                  <p className="text-xs text-slate-500">
                    Use your custom highlight color for the player car instead of
                    class color
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.config.useHighlightColor ?? false}
                  onToggle={(enabled) =>
                    handleConfigChange({
                      useHighlightColor: enabled,
                    })
                  }
                />
              </div>

          </div>
          </div>

          {/* Session Visibility Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">Session Visibility</h3>
            </div>
            <div className="space-y-3 pl-4">
              <SessionVisibility
                sessionVisibility={settings.config.sessionVisibility}
                handleConfigChange={handleConfigChange}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pl-4 border-t border-slate-700/50 pt-4">
            <div>
              <span className="text-md text-slate-300">Show Only When On Track</span>
              <p className="text-slate-500 text-xs">
                If enabled, the flat map will only be shown when you are driving.
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.config.showOnlyWhenOnTrack ?? false}
              onToggle={(enabled) =>
                handleConfigChange({
                  showOnlyWhenOnTrack: enabled,
                })
              }
            />
          </div>

        </div>
      )}
    </BaseSettingsSection>
  );
};
