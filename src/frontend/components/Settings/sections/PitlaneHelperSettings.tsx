import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
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
        <div className="space-y-4">
          {/* Visibility Mode */}
          <div>
            <label className="block mb-2 font-medium">Visibility Mode</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="showMode"
                  value="approaching"
                  checked={settings.config.showMode === 'approaching'}
                  onChange={(e) =>
                    handleConfigChange({ showMode: e.target.value as 'approaching' })
                  }
                  className="cursor-pointer"
                />
                <span>Show when approaching pit (recommended)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="showMode"
                  value="onPitRoad"
                  checked={settings.config.showMode === 'onPitRoad'}
                  onChange={(e) =>
                    handleConfigChange({ showMode: e.target.value as 'onPitRoad' })
                  }
                  className="cursor-pointer"
                />
                <span>Only show when on pit road</span>
              </label>
            </div>
          </div>

          {/* Approach Distance */}
          {settings.config.showMode === 'approaching' && (
            <div>
              <label className="block mb-2 font-medium">
                Approach Distance: {settings.config.approachDistance}m
              </label>
              <input
                type="range"
                min="100"
                max="500"
                step="10"
                value={settings.config.approachDistance}
                onChange={(e) =>
                  handleConfigChange({ approachDistance: parseInt(e.target.value) })
                }
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>100m</span>
                <span>500m</span>
              </div>
            </div>
          )}

          {/* Pit Limiter Warning */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.config.enablePitLimiterWarning}
                onChange={(e) =>
                  handleConfigChange({ enablePitLimiterWarning: e.target.checked })
                }
                className="cursor-pointer"
              />
              <span className="font-medium">Enable Pit Limiter Warning</span>
            </label>
            <p className="text-xs text-slate-400 mt-1 ml-6">
              Flash warning if entering pit without limiter (critical for team races)
            </p>
          </div>

          {/* Early Pitbox Warning */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.config.enableEarlyPitboxWarning}
                onChange={(e) =>
                  handleConfigChange({ enableEarlyPitboxWarning: e.target.checked })
                }
                className="cursor-pointer"
              />
              <span className="font-medium">Enable Early Pitbox Warning</span>
            </label>
            <p className="text-xs text-slate-400 mt-1 ml-6">
              Alert when pitbox is near pit entry
            </p>
          </div>

          {/* Early Pitbox Threshold */}
          {settings.config.enableEarlyPitboxWarning && (
            <div className="ml-6">
              <label className="block mb-2 font-medium">
                Early Warning Threshold: {settings.config.earlyPitboxThreshold}m
              </label>
              <input
                type="range"
                min="25"
                max="150"
                step="5"
                value={settings.config.earlyPitboxThreshold}
                onChange={(e) =>
                  handleConfigChange({ earlyPitboxThreshold: parseInt(e.target.value) })
                }
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>25m</span>
                <span>150m</span>
              </div>
            </div>
          )}

          {/* Show Pitlane Traffic */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.config.showPitlaneTraffic}
                onChange={(e) =>
                  handleConfigChange({ showPitlaneTraffic: e.target.checked })
                }
                className="cursor-pointer"
              />
              <span className="font-medium">Show Pitlane Traffic</span>
            </label>
            <p className="text-xs text-slate-400 mt-1 ml-6">
              Display count of cars ahead/behind in pitlane
            </p>
          </div>

          {/* Background Opacity */}
          <div>
            <label className="block mb-2 font-medium">
              Background Opacity: {settings.config.background.opacity}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.config.background.opacity}
              onChange={(e) =>
                handleConfigChange({
                  background: { opacity: parseInt(e.target.value) },
                })
              }
              className="w-full cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
