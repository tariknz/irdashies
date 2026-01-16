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
  numberDriversBehind: 1,
  alignDriverBoxes: 'Top',
  closestDriverBox: 'Top',
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
      numberDriversBehind:
        (config.numberDriversBehind as number) ?? defaultConfig.numberDriversBehind,
      alignDriverBoxes:
        (config.alignDriverBoxes as 'Top' | 'Bottom') ?? defaultConfig.alignDriverBoxes,
      closestDriverBox:
        (config.closestDriverBox as 'Top' | 'Reverse') ?? defaultConfig.closestDriverBox,
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
          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Distance Threshold</span>
              <input
                type="number"
                value={settings.config.distanceThreshold}
                onChange={(e) =>
                  handleConfigChange({
                    distanceThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
                step="0.1"
              />
            </div>
          </div>

          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Drivers Behind</span>
              <select
                value={settings.config.numberDriversBehind}
                onChange={(e) =>
                  handleConfigChange({
                    numberDriversBehind: parseInt(e.target.value),
                  })
                }
                className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Align Driver Boxes</span>
              <select
                value={settings.config.alignDriverBoxes}
                onChange={(e) =>
                  handleConfigChange({
                    alignDriverBoxes: e.target.value as 'Top' | 'Bottom',
                  })
                }
                className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
              >
                <option value="Top">Top</option>
                <option value="Bottom">Bottom</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Closest Driver</span>
              <select
                value={settings.config.closestDriverBox}
                onChange={(e) =>
                  handleConfigChange({
                    closestDriverBox: e.target.value as 'Top' | 'Reverse',
                  })
                }
                className="w-20 bg-slate-700 text-white rounded-md px-2 py-1"
              >
                <option value="Top">Top</option>
                <option value="Reverse">Reverse</option>
              </select>
            </div>
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
