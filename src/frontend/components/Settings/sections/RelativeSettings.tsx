import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { RelativeWidgetSettings } from '../types';

const SETTING_ID = 'relative';

const defaultConfig: RelativeWidgetSettings['config'] = {
  buffer: 3,
  background: { opacity: 0 },
};

const migrateConfig = (savedConfig: unknown): RelativeWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    buffer: (config.buffer as { value?: number })?.value ?? 3,
    background: { opacity: (config.background as { opacity?: number })?.opacity ?? 0 },
  };
};

export const RelativeSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RelativeWidgetSettings | undefined;
  const [settings, setSettings] = useState<RelativeWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Relative Settings"
      description="Configure the relative timing display settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="relative"
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Buffer Size</span>
              <p className="text-xs text-slate-400">
                Number of drivers to show above and below the player
              </p>
            </div>
            <select
              value={settings.config.buffer}
              onChange={(e) =>
                handleConfigChange({ buffer: parseInt(e.target.value) })
              }
              className="bg-slate-700 text-slate-200 px-3 py-1 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
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
      )}
    </BaseSettingsSection>
  );
};
