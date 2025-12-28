import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'map';

interface TrackMapSettings {
  enabled: boolean;
  config: {
    enableTurnNames: boolean;
  };
}

const defaultConfig: TrackMapSettings['config'] = {
  enableTurnNames: false
};

export const TrackMapSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<TrackMapSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === SETTING_ID)?.enabled ?? false,
    config: currentDashboard?.widgets.find(w => w.id === SETTING_ID)?.config as TrackMapSettings['config'] ?? defaultConfig,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Track Map"
      description="Configure track map visualization settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="map"
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="bg-yellow-600/20 text-yellow-100 p-4 rounded-md mb-4">
            <p>This is still a work in progress. There are several tracks still missing, please report any issues/requests.</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-300">Enable Turn Names</span>
              <p className="text-xs text-slate-400">
                Show turn numbers and names on the track map
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.config.enableTurnNames}
              onToggle={(enabled) => handleConfigChange({
                enableTurnNames: enabled
              })}
            />
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
}; 