import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'flatmap';

interface FlatTrackMapSettings {
  enabled: boolean;
  config: {
    showCarNumbers: boolean;
    driverCircleSize: number;
    playerCircleSize: number;
    trackLineWidth: number;
    trackOutlineWidth: number;
    invertTrackColors: boolean;
    useHighlightColor: boolean;
  };
}

const defaultConfig: FlatTrackMapSettings['config'] = {
  showCarNumbers: true,
  driverCircleSize: 40,
  playerCircleSize: 40,
  trackLineWidth: 20,
  trackOutlineWidth: 40,
  invertTrackColors: false,
  useHighlightColor: false,
};

export const FlatTrackMapSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<FlatTrackMapSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config:
      (currentDashboard?.widgets.find((w) => w.id === SETTING_ID)
        ?.config as FlatTrackMapSettings['config']) ?? defaultConfig,
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
        </div>
      )}
    </BaseSettingsSection>
  );
};
