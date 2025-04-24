import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TrackMapWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

export const TrackMapSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<TrackMapWidgetSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === 'map')?.enabled ?? false,
    // Add other settings here as needed
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Track Map Settings"
      description="Configure track map visualization settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="map"
    >
      <div className="bg-yellow-600/20 text-yellow-100 p-4 rounded-md mb-4">
        <p>This feature is experimental and may not work as expected.</p>
      </div>
      {/* Add specific settings controls here */}
      <div className="text-slate-300">
        Additional settings will appear here
      </div>
    </BaseSettingsSection>
  );
}; 