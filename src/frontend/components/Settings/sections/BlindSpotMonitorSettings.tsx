import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  BlindSpotMonitorWidgetSettings,
  SessionVisibilitySettings,
} from '../types';
import { SessionVisibility } from '../components/SessionVisibility';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'blindspotmonitor';

const defaultConfig: BlindSpotMonitorWidgetSettings['config'] = {
  showOnlyWhenOnTrack: true,
  distAhead: 4,
  distBehind: 4,
  background: {
    opacity: 30,
  },
  width: 20,
  sessionVisibility: {
    race: true,
    loneQualify: false,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const migrateConfig = (
  savedConfig: unknown
): BlindSpotMonitorWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;
  return {
    showOnlyWhenOnTrack:
      (config.showOnlyWhenOnTrack as boolean) ??
      defaultConfig.showOnlyWhenOnTrack,
    distAhead: (config.distAhead as number) ?? defaultConfig.distAhead,
    distBehind: (config.distBehind as number) ?? defaultConfig.distBehind,
    background: {
      opacity:
        (config.background as { opacity?: number })?.opacity ??
        (defaultConfig.background?.opacity as number),
    },
    width: (config.width as number) ?? defaultConfig.width,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
  };
};

export const BlindSpotMonitorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BlindSpotMonitorWidgetSettings | undefined;
  const [settings, setSettings] = useState<BlindSpotMonitorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Blind Spot Monitor"
      description="Configure settings for the blind spot monitor widget that displays visual indicators when cars are detected on your left or right side."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          {/* Background Opacity */}
          <div className="space-y-2">
            <label className="text-slate-300">
              Background Opacity: {settings.config.background?.opacity ?? 30}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.config.background?.opacity ?? 30}
              onChange={(e) =>
                handleConfigChange({
                  background: { opacity: parseInt(e.target.value) },
                })
              }
              className="w-full"
            />
          </div>

          {/* Distance Ahead */}
          <div className="space-y-2">
            <label className="text-slate-300">
              Distance Ahead: {settings.config.distAhead}m
            </label>
            <input
              type="range"
              min="3"
              max="6"
              step="0.1"
              value={settings.config.distAhead}
              onChange={(e) =>
                handleConfigChange({ distAhead: parseFloat(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">
              Distance to car ahead in meters. Distance at which point line
              starts to appear at the top.
            </p>
          </div>

          {/* Distance Behind */}
          <div className="space-y-2">
            <label className="text-slate-300">
              Distance Behind: {settings.config.distBehind}m
            </label>
            <input
              type="range"
              min="3"
              max="6"
              step="0.1"
              value={settings.config.distBehind}
              onChange={(e) =>
                handleConfigChange({ distBehind: parseFloat(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">
              Distance to car behind in meters. Distance at which point line
              starts to appear at the bottom.
            </p>
          </div>

          {/* Width */}
          <div className="space-y-2">
            <label className="text-slate-300">
              Width: {settings.config.width ?? 20}px
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="1"
              value={settings.config.width ?? 20}
              onChange={(e) =>
                handleConfigChange({ width: parseInt(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-slate-400 text-sm">
              Width of the blind spot indicator in pixels.
            </p>
          </div>

          {/* IsOnTrack Section */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">
                Show only when on track
              </h4>
              <span className="block text-xs text-slate-500">
                If enabled, blind spotter will only be shown when you are
                driving.
              </span>
            </div>
            <ToggleSwitch
              enabled={settings.config.showOnlyWhenOnTrack}
              onToggle={(newValue) =>
                handleConfigChange({
                  showOnlyWhenOnTrack: newValue,
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
