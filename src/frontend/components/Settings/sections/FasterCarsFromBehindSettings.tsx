import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  FasterCarsFromBehindWidgetSettings,
  SessionVisibilitySettings,
} from '../types';
import { SessionVisibility } from '../components/SessionVisibility';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
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
  showName: true,
  showDistance: true,
  showBadge: true,
  badgeFormat: 'license-color-rating-bw',
  onlyShowFasterClasses: true,
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
        (config.numberDriversBehind as number) ??
        defaultConfig.numberDriversBehind,
      alignDriverBoxes:
        (config.alignDriverBoxes as 'Top' | 'Bottom') ??
        defaultConfig.alignDriverBoxes,
      closestDriverBox:
        (config.closestDriverBox as 'Top' | 'Reverse') ??
        defaultConfig.closestDriverBox,
      showName: (config.showName as boolean) ?? defaultConfig.showName,
      showDistance:
        (config.showDistance as boolean) ?? defaultConfig.showDistance,
      showBadge: (config.showBadge as boolean) ?? defaultConfig.showBadge,
      badgeFormat: (config.badgeFormat as string) ?? defaultConfig.badgeFormat,
      onlyShowFasterClasses:
        (config.onlyShowFasterClasses as boolean) ??
        defaultConfig.onlyShowFasterClasses,
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

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-200">Display</h3>   
            <div className="pl-4 space-y-4">  

              {/* Distance Threshold */}
              <div className="space-y-2">
                <label className="text-slate-300">
                  Distance Threshold:{' '}
                  {Math.abs(settings.config.distanceThreshold).toFixed(1)} seconds
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="20"
                  step="0.1"
                  value={Math.abs(settings.config.distanceThreshold)}
                  onChange={(e) =>
                    handleConfigChange({
                      distanceThreshold: -parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <p className="text-slate-500 text-xs">
                  Minimum gap to a faster car before it is displayed. Smaller values
                  show cars that are closer behind you.
                </p>
              </div>

              {/* Show Distance Section */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-md font-medium text-slate-300">
                    Show Distance
                  </h4>
                  <span className="block text-xs text-slate-500">
                    Display the distance to the faster car.
                  </span>
                </div>
                <ToggleSwitch
                  enabled={settings.config.showDistance}
                  onToggle={(newValue) =>
                    handleConfigChange({
                      showDistance: newValue,
                    })
                  }
                />
              </div>

          {/* Show Name Section */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">Show Name</h4>
              <span className="block text-xs text-slate-500">
                Display the driver name in the faster cars widget.
              </span>
            </div>
            <ToggleSwitch
              enabled={settings.config.showName}
              onToggle={(newValue) =>
                handleConfigChange({
                  showName: newValue,
                })
              }
            />
          </div>

              {/* Show Badge Section */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-md font-medium text-slate-300">
                    Show Driver Badge
                  </h4>
                  <span className="block text-xs text-slate-500">
                    Display the driver license and iRating badge.
                  </span>
                </div>
                <ToggleSwitch
                  enabled={settings.config.showBadge}
                  onToggle={(newValue) =>
                    handleConfigChange({
                      showBadge: newValue,
                    })
                  }
                />
              </div>

              {/* Badge Format Selector */}
              {settings.config.showBadge && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-3 justify-end">
                    {(
                      [
                        'license-color-fullrating-combo',
                        'fullrating-color-no-license',
                        'rating-color-no-license',
                        'license-color-fullrating-bw',
                        'license-color-rating-bw',
                        'rating-only-color-rating-bw',
                        'license-color-rating-bw-no-license',                    
                        'license-bw-rating-bw',
                        'rating-only-bw-rating-bw',
                        'license-bw-rating-bw-no-license',
                        'rating-bw-no-license',
                        'fullrating-bw-no-license',                     
                      ] as const
                    ).map((format) => (
                      <BadgeFormatPreview
                        key={format}
                        format={format}
                        selected={settings.config.badgeFormat === format}
                        onClick={() => {
                          handleConfigChange({
                            badgeFormat: format,
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Drivers Behind</span>
                  <select
                    value={settings.config.numberDriversBehind}
                    onChange={(e) =>
                      handleConfigChange({
                        numberDriversBehind: parseInt(e.target.value),
                      })
                    }
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Align Driver Boxes</span>
                  <select
                    value={settings.config.alignDriverBoxes}
                    onChange={(e) =>
                      handleConfigChange({
                        alignDriverBoxes: e.target.value as 'Top' | 'Bottom',
                      })
                    }
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="Top">Align to Top of Widget</option>
                    <option value="Bottom">Align to Bottom of Widget</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Closest Driver</span>
                  <select
                    value={settings.config.closestDriverBox}
                    onChange={(e) =>
                      handleConfigChange({
                        closestDriverBox: e.target.value as 'Top' | 'Reverse',
                      })
                    }
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="Top">Closest Driver at Top</option>
                    <option value="Reverse">Closest Driver at Bottom</option>
                  </select>
                </div>
              </div>          

              {/* Only Show Faster Classes Section */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-md font-medium text-slate-300">
                    Only show faster classes
                  </h4>
                  <span className="block text-xs text-slate-500">
                    If enabled, only cars from faster classes will be shown.
                    Same-class competitors will be hidden.
                  </span>
                </div>
                <ToggleSwitch
                  enabled={settings.config.onlyShowFasterClasses}
                  onToggle={(newValue) =>
                    handleConfigChange({
                      onlyShowFasterClasses: newValue,
                    })
                  }
                />
              </div>

            </div>
          </div>

          {/* Session Visibility Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">
                Session Visibility
              </h3>
            </div>
            <div className="space-y-3 px-4">
              <SessionVisibility
                sessionVisibility={settings.config.sessionVisibility}
                handleConfigChange={handleConfigChange}
              />
            </div>
          </div>

          {/* IsOnTrack Section */}
          <div className="flex items-center justify-between pl-4 pt-4 border-t border-slate-700/50">
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

        </div>
      )}
    </BaseSettingsSection>
  );
};
