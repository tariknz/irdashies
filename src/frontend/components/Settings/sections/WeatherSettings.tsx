import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { WeatherWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

export const WeatherSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<WeatherWidgetSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === 'weather')?.enabled ?? false,
    // Add other settings here as needed
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
      widgetId="weather"
    >
      {/* Add specific settings controls here */}
      <div className="text-slate-300">
        Additional settings will appear here
      </div>
    </BaseSettingsSection>
  );
}; 