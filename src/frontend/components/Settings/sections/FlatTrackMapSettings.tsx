import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { FlatTrackMapWidgetSettings, SessionVisibilitySettings } from '../types';
import { SessionVisibility } from '../components/SessionVisibility';

const SETTING_ID = 'flatmap';

const defaultConfig: FlatTrackMapWidgetSettings['config'] = {
  showCarNumbers: true,
  driverCircleSize: 40,
  playerCircleSize: 40,
  trackLineWidth: 20,
  trackOutlineWidth: 40,
  invertTrackColors: false,
  useHighlightColor: false,
  sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: false }
};

const migrateConfig = (savedConfig: unknown): FlatTrackMapWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;
  return {
    showCarNumbers: (config.showCarNumbers as boolean) ?? defaultConfig.showCarNumbers,
    driverCircleSize: (config.driverCircleSize as number) ?? defaultConfig.driverCircleSize,
    playerCircleSize: (config.playerCircleSize as number) ?? defaultConfig.playerCircleSize,
    trackLineWidth: (config.trackLineWidth as number) ?? defaultConfig.trackLineWidth,
    trackOutlineWidth: (config.trackOutlineWidth as number) ?? defaultConfig.trackOutlineWidth,
    invertTrackColors: (config.invertTrackColors as boolean) ?? defaultConfig.invertTrackColors,
    useHighlightColor: (config.useHighlightColor as boolean) ?? defaultConfig.useHighlightColor,
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
            <p className="text-slate-400 text-sm">
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
            <p className="text-slate-400 text-sm">
              Size of the circle for your car (matches curved track map scale)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">
                Use Highlight Color for Player
              </span>
              <p className="text-xs text-slate-400">
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

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Invert Track Colors</span>
              <p className="text-xs text-slate-400">
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
            <p className="text-slate-400 text-sm">
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
            <p className="text-slate-400 text-sm">
              Thickness of the outline around the track
            </p>
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
        </div>
      )}
    </BaseSettingsSection>
  );
};
