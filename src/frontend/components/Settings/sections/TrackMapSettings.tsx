import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'map';

interface TrackMapSettings {
  enabled: boolean;
  config: {
    mapStyle: 'shape' | 'flat';
    enableTurnNames: boolean;
    showCarNumbers: boolean;
    invertTrackColors: boolean;
    driverCircleSize: number;
    playerCircleSize: number;
    trackLineWidth: number;
    trackOutlineWidth: number;
    useHighlightColor: boolean;
  };
}

const defaultConfig: TrackMapSettings['config'] = {
  mapStyle: 'shape',
  enableTurnNames: false,
  showCarNumbers: true,
  invertTrackColors: false,
  driverCircleSize: 40,
  playerCircleSize: 40,
  trackLineWidth: 20,
  trackOutlineWidth: 40,
  useHighlightColor: false
};

export const TrackMapSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<TrackMapSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === SETTING_ID)?.enabled ?? false,
    config: currentDashboard?.widgets.find(w => w.id === SETTING_ID)?.config as TrackMapSettings['config'] ?? defaultConfig,
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
          <div className="space-y-2">
            <label className="text-slate-300">Map Style</label>
            <select
              value={settings.config.mapStyle ?? 'shape'}
              onChange={(e) =>
                handleConfigChange({ mapStyle: e.target.value as 'shape' | 'flat' })
              }
              className="w-full bg-slate-700 text-slate-300 rounded px-3 py-2"
            >
              <option value="shape">Shape (Curved Track)</option>
              <option value="flat">Flat (Linear Track)</option>
            </select>
            <p className="text-slate-400 text-sm">
              Choose between curved track layout or horizontal linear representation
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Enable Turn Names</span>
              <p className="text-xs text-slate-400">
                {settings.config.mapStyle === 'flat'
                  ? 'Not available for flat map style'
                  : 'Show turn numbers and names on the track map'}
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.config.enableTurnNames}
              onToggle={(enabled) => handleConfigChange({
                enableTurnNames: enabled
              })}
              disabled={settings.config.mapStyle === 'flat'}
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
              onToggle={(enabled) => handleConfigChange({
                showCarNumbers: enabled
              })}
            />
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
                handleConfigChange({ driverCircleSize: parseInt(e.target.value) || 40 })
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
                handleConfigChange({ playerCircleSize: parseInt(e.target.value) || 40 })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">
              Size of the circle for the player on the track map
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Use Highlight Color</span>
              <p className="text-xs text-slate-400">
                Use the highlight color from general settings for the player&apos;s circle
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.config.useHighlightColor ?? false}
              onToggle={(enabled) => handleConfigChange({
                useHighlightColor: enabled
              })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Invert Track Colors</span>
              <p className="text-xs text-slate-400">
                Use black track with white outline instead of white track with black outline
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.config.invertTrackColors ?? false}
              onToggle={(enabled) => handleConfigChange({
                invertTrackColors: enabled
              })}
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
                handleConfigChange({ trackLineWidth: parseInt(e.target.value) ?? 20 })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">
              Width of the track line
            </p>
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
                handleConfigChange({ trackOutlineWidth: parseInt(e.target.value) ?? 40 })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">
              Width of the track outline
            </p>
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
}; 