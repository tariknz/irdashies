import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { ToggleSwitch } from '../components/ToggleSwitch';
import type { PitlaneHelperWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

const SETTING_ID = 'pitlanehelper';

const defaultConfig: PitlaneHelperWidgetSettings['config'] = {
  showMode: 'approaching',
  approachDistance: 200,
  enablePitLimiterWarning: true,
  enableEarlyPitboxWarning: true,
  earlyPitboxThreshold: 75,
  showPitlaneTraffic: true,
  background: { opacity: 80 },
};

export const PitlaneHelperSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as PitlaneHelperWidgetSettings | undefined;

  const [settings, setSettings] = useState<PitlaneHelperWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: savedSettings?.config ?? defaultConfig,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Pitlane Helper"
      description="Assists with pit entry by showing speed delta, pitbox position, and warnings."
      settings={settings}
      onSettingsChange={(s) => setSettings(s)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-8">
          {/* Visibility Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-200">Visibility</h3>
            <div className="space-y-3 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">Show when approaching pit</span>
                  <p className="text-xs text-slate-400">Display overlay before entering pit lane</p>
                </div>
                <ToggleSwitch
                  enabled={settings.config.showMode === 'approaching'}
                  onToggle={(enabled) =>
                    handleConfigChange({ showMode: enabled ? 'approaching' : 'onPitRoad' })
                  }
                />
              </div>

              {settings.config.showMode === 'approaching' && (
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-slate-300">Approach Distance</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="100"
                      max="500"
                      step="10"
                      value={settings.config.approachDistance}
                      onChange={(e) =>
                        handleConfigChange({ approachDistance: parseInt(e.target.value) })
                      }
                      className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 w-12">
                      {settings.config.approachDistance}m
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Warning Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-200">Warnings</h3>
            <div className="space-y-3 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">Pit Limiter Warning</span>
                  <p className="text-xs text-slate-400">Flash warning if entering pit without limiter</p>
                </div>
                <ToggleSwitch
                  enabled={settings.config.enablePitLimiterWarning}
                  onToggle={(enabled) =>
                    handleConfigChange({ enablePitLimiterWarning: enabled })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">Early Pitbox Warning</span>
                  <p className="text-xs text-slate-400">Alert when pitbox is near pit entry</p>
                </div>
                <ToggleSwitch
                  enabled={settings.config.enableEarlyPitboxWarning}
                  onToggle={(enabled) =>
                    handleConfigChange({ enableEarlyPitboxWarning: enabled })
                  }
                />
              </div>

              {settings.config.enableEarlyPitboxWarning && (
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-slate-300">Early Warning Threshold</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="25"
                      max="150"
                      step="5"
                      value={settings.config.earlyPitboxThreshold}
                      onChange={(e) =>
                        handleConfigChange({ earlyPitboxThreshold: parseInt(e.target.value) })
                      }
                      className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 w-10">
                      {settings.config.earlyPitboxThreshold}m
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Traffic Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-200">Traffic</h3>
            <div className="space-y-3 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">Show Pitlane Traffic</span>
                  <p className="text-xs text-slate-400">Display count of cars ahead/behind in pitlane</p>
                </div>
                <ToggleSwitch
                  enabled={settings.config.showPitlaneTraffic}
                  onToggle={(enabled) =>
                    handleConfigChange({ showPitlaneTraffic: enabled })
                  }
                />
              </div>
            </div>
          </div>

          {/* Background Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-200">Background</h3>
            <div className="space-y-3 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Background Opacity</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.config.background.opacity}
                    onChange={(e) =>
                      handleConfigChange({
                        background: { opacity: parseInt(e.target.value) },
                      })
                    }
                    className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 w-8">
                    {settings.config.background.opacity}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
