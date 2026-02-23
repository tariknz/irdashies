import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TrackMapWidgetSettings, SessionVisibilitySettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SessionVisibility } from '../components/SessionVisibility';

const SETTING_ID = 'map';

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
  uiStyle: 'default',
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
  return {
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
    uiStyle: (config.uiStyle as 'default' | 'minimal') ?? 'default',
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
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Enable Turn Names</span>
              <p className="text-xs text-slate-400">
                Show turn numbers and names on the track map
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.config.enableTurnNames}
              onToggle={(enabled) =>
                handleConfigChange({
                  enableTurnNames: enabled,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Show Car Numbers</span>
              <p className="text-xs text-slate-400">
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

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Display Mode</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfigChange({ displayMode: 'carNumber' })}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  settings.config.displayMode === 'carNumber'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                Car Number
              </button>
              <button
                onClick={() =>
                  handleConfigChange({ displayMode: 'sessionPosition' })
                }
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  settings.config.displayMode === 'sessionPosition'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                Session Position
              </button>
              <button
                onClick={() =>
                  handleConfigChange({ displayMode: 'livePosition' })
                }
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  settings.config.displayMode === 'livePosition'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                Live Position
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-slate-300">
              Driver Circle Size: {settings.config.driverCircleSize ?? 40}px
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={settings.config.driverCircleSize ?? 40}
              onChange={(e) =>
                handleConfigChange({
                  driverCircleSize: parseInt(e.target.value) || 40,
                })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">
              Size of the circle for other drivers on the track map
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
            <p className="text-slate-400 text-sm">
              Size of the circle for the player on the track map
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
            <p className="text-slate-400 text-sm">
              Relative size of the font within the track map
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">
                Use Highlight Color
              </span>
              <p className="text-xs text-slate-400">
                Use the highlight color from general settings for the
                player&apos;s circle
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

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">
                Invert Track Colors
              </span>
              <p className="text-xs text-slate-400">
                Use black track with white outline instead of white track with
                black outline
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

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">
                High Contrast Turn Names
              </span>
              <p className="text-xs text-slate-400">
                Use black background for turn numbers and turn names for better
                legibility
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.config.highContrastTurns ?? false}
              onToggle={(enabled) =>
                handleConfigChange({
                  highContrastTurns: enabled,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-slate-300">
              Track Line Width: {settings.config.trackLineWidth ?? 20}px
            </label>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={settings.config.trackLineWidth ?? 20}
              onChange={(e) =>
                handleConfigChange({
                  trackLineWidth: parseInt(e.target.value) ?? 20,
                })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">Width of the track line</p>
          </div>

          <div className="space-y-2">
            <label className="text-slate-300">
              Track Outline Width: {settings.config.trackOutlineWidth ?? 40}px
            </label>
            <input
              type="range"
              min="1"
              max="150"
              step="1"
              value={settings.config.trackOutlineWidth ?? 40}
              onChange={(e) =>
                handleConfigChange({
                  trackOutlineWidth: parseInt(e.target.value) ?? 40,
                })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">Width of the track outline</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Widget Style</span>
            <select
              value={settings.config.uiStyle ?? 'default'}
              onChange={(e) =>
                handleConfigChange({
                  uiStyle: e.target.value as 'default' | 'minimal',
                })
              }
              className="bg-slate-700 text-white rounded-md px-2 py-1"
            >
              <option value="default">Default</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">
                Show Only When On Track
              </span>
              <p className="text-xs text-slate-400">
                Hide the track map when not actively driving on track
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

          {/* Session Visibility Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">
                Session Visibility
              </h3>
            </div>
            <div className="space-y-3 pl-4">
              <SessionVisibility
                sessionVisibility={settings.config.sessionVisibility}
                handleConfigChange={handleConfigChange}
              />
            </div>
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
