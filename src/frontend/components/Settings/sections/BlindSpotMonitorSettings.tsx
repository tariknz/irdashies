import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { BlindSpotMonitorWidgetSettings } from '../types';

const SETTING_ID = 'blindspotmonitor';

const defaultConfig: BlindSpotMonitorWidgetSettings['config'] = {
  lineColor: '#ffffff',
  lineOpacity: 100,
  lineWidth: 5,
  distAhead: 4,
  distBehind: 4,
};

export const BlindSpotMonitorSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<BlindSpotMonitorWidgetSettings>({
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ?? false,
    config:
      (currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.config as
        | BlindSpotMonitorWidgetSettings['config']
        | undefined) ?? defaultConfig,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Blind Spot Monitor Settings"
      description="Configure settings for the blind spot monitor widget that displays visual indicators when cars are detected on your left or right side."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          {/* Line Color */}
          <div className="space-y-2">
            <label className="text-slate-300">Line Color</label>
            <input
              type="color"
              value={settings.config.lineColor}
              onChange={(e) =>
                handleConfigChange({ lineColor: e.target.value })
              }
              className="w-full h-10 rounded border-gray-600 bg-gray-700"
            />
          </div>

          {/* Line Opacity */}
          <div className="space-y-2">
            <label className="text-slate-300">
              Line Opacity: {settings.config.lineOpacity}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.config.lineOpacity}
              onChange={(e) =>
                handleConfigChange({ lineOpacity: parseInt(e.target.value) })
              }
              className="w-full"
            />
          </div>

          {/* Line Width */}
          <div className="space-y-2">
            <label className="text-slate-300">
              Line Width: {settings.config.lineWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="80"
              step="1"
              value={settings.config.lineWidth}
              onChange={(e) =>
                handleConfigChange({ lineWidth: parseInt(e.target.value) })
              }
              className="w-full"
            />
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <label className="text-slate-300">Background Color (Optional)</label>
            <input
              type="color"
              value={settings.config.bgColor || '#000000'}
              onChange={(e) =>
                handleConfigChange({ bgColor: e.target.value })
              }
              className="w-full h-10 rounded border-gray-600 bg-gray-700"
            />
          </div>

          {/* Background Opacity */}
          {settings.config.bgColor && (
            <div className="space-y-2">
              <label className="text-slate-300">
                Background Opacity: {settings.config.bgOpacity || 0}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.config.bgOpacity || 0}
                onChange={(e) =>
                  handleConfigChange({ bgOpacity: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
          )}

          {/* Background Width */}
          {settings.config.bgColor && (
            <div className="space-y-2">
              <label className="text-slate-300">
                Background Width: {settings.config.bgWidth || 0}px
              </label>
              <input
                type="range"
                min="1"
                max="80"
                step="1"
                value={settings.config.bgWidth || 0}
                onChange={(e) =>
                  handleConfigChange({ bgWidth: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
          )}

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
              Distance to car ahead in meters. Distance at which point line starts to appear at the top.
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
              Distance to car behind in meters. Distance at which point line starts to appear at the bottom.
            </p>
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};

