import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';

const SETTING_ID = 'fastercarsfrombehind';

interface FasterCarsFromBehindSettings {
  enabled: boolean;
  config: {
    distanceThreshold: number;
  };
}

const defaultConfig: FasterCarsFromBehindSettings['config'] = {
  distanceThreshold: -0.3
};

export const FasterCarsFromBehindSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<FasterCarsFromBehindSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === SETTING_ID)?.enabled ?? false,
    config: currentDashboard?.widgets.find(w => w.id === SETTING_ID)?.config as FasterCarsFromBehindSettings['config'] ?? defaultConfig,
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
              onChange={(e) => handleConfigChange({
                distanceThreshold: parseFloat(e.target.value)
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