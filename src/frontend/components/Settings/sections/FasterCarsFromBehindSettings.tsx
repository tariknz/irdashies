import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  FasterCarsFromBehindWidgetSettings,
  SessionVisibilitySettings,
} from '../types';
import { SessionVisibility } from '../components/SessionVisibility';
import { useDashboard } from '@irdashies/context';
import { useFasterCarsSettings } from '../../FasterCarsFromBehind/hooks/useFasterCarsSettings';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'fastercarsfrombehind';

const defaultConfig: FasterCarsFromBehindWidgetSettings['config'] = {
  showOnlyWhenOnTrack: true,
  distanceThreshold: -0.3,
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
): FasterCarsFromBehindWidgetSettings['config'] => {
  if (typeof savedConfig === 'object' && savedConfig !== null) {
    const config = savedConfig as Record<string, unknown>;
    return {
      showOnlyWhenOnTrack:
        (config.showOnlyWhenOnTrack as boolean) ??
        defaultConfig.showOnlyWhenOnTrack,
      distanceThreshold:
        (config.distanceThreshold as number) ?? defaultConfig.distanceThreshold,
      sessionVisibility:
        (config.sessionVisibility as SessionVisibilitySettings) ??
        defaultConfig.sessionVisibility,
    };
  }
  return defaultConfig;
};

export const FasterCarsFromBehindSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<FasterCarsFromBehindWidgetSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config: migrateConfig(useFasterCarsSettings()),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Faster Cars From Behind"
      description="Configure settings for the faster cars detection widget."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="fastercarsfrombehind"
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-slate-300">Distance Threshold</label>
            <input
              type="number"
              value={settings.config.distanceThreshold}
              onChange={(e) =>
                handleConfigChange({
                  distanceThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
              step="0.1"
            />
          </div>

          {/* IsOnTrack Section */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">
                Show only when on track
              </h4>
              <span className="block text-xs text-slate-500">
                If enabled, faster cars will only be shown when you are driving.
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
