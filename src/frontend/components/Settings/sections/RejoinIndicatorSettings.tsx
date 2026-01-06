import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { RejoinIndicatorWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

const SETTING_ID = "rejoin"

const defaultConfig: RejoinIndicatorWidgetSettings['config'] = {
  showAtSpeed: 30,
  careGap: 2,
  stopGap: 1,
};

const migrateConfig = (
  savedConfig: unknown
): RejoinIndicatorWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    showAtSpeed: (config.showAtSpeed as number) ?? 30,
    careGap: (config.careGap as number) ?? 2,
    stopGap: (config.stopGap as number) ?? 1,
  };
};

export const RejoinIndicatorSettings = () => {
    const { currentDashboard } = useDashboard();
    const savedSettings = currentDashboard?.widgets.find(
        (w) => w.id === SETTING_ID
    ) as RejoinIndicatorWidgetSettings | undefined;
    const [settings, setSettings] = useState<RejoinIndicatorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Rejoin Indicator"
      description="Configure settings for the Rejoin Indicator. Note: The widget automatically hides while you're in the garage, in a pit stall, or on pit road."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">     
        {/* Show At Speed */}
          <div className="space-y-2">
            <span className="text-slate-300">Show At Speed</span>
              <p className="text-slate-400">Display the rejoin indicator widget when you are at or below this speed</p>
            <input
              type="number"
              value={settings.config.showAtSpeed}
              onChange={(e) => handleConfigChange({
                showAtSpeed: parseFloat(e.target.value)
              })}
              className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
              step="0.1"
            />
          </div>

          {/* Care gap to rejoin */}
          <div className="space-y-2">
            <span className="text-slate-300">Care Gap</span>
              <p className="text-slate-400">Distance to the car behind where you need to be cautious when rejoining. Note: the clear status will show when next car is above this gap</p>
            <input
              type="number"
              value={settings.config.careGap}
              onChange={(e) => handleConfigChange({
                careGap: parseFloat(e.target.value)
              })}
              className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
              step="0.1"
            />
          </div>
          {/* Do not rejoin gap */}
          <div className="space-y-2">
            <span className="text-slate-300">Stop Gap</span>
              <p className="text-slate-400">Distance to the car behind where it is not safe to rejoin</p>
            <input
              type="number"
              value={settings.config.stopGap}
              onChange={(e) => handleConfigChange({
                stopGap: parseFloat(e.target.value)
              })}
              className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
              step="0.1"
            />
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};