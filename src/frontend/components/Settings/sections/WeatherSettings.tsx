import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { WeatherWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

const SETTING_ID = 'weather';

const defaultConfig: WeatherWidgetSettings['config'] = {
  background: { opacity: 0 },
};

const migrateConfig = (savedConfig: unknown): WeatherWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    background: { opacity: (config.background as { opacity?: number })?.opacity ?? 0 },
  };
};

export const WeatherSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as WeatherWidgetSettings | undefined;
  const [settings, setSettings] = useState<WeatherWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Weather Settings"
      description="Configure weather widget display options."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Background Opacity</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.config.background.opacity}
                onChange={(e) =>
                  handleConfigChange({ background: { opacity: parseInt(e.target.value) } })
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