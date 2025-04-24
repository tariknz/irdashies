import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { StandingsWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

export const StandingsSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<StandingsWidgetSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === 'standings')?.enabled ?? false,
    // Add other settings here as needed
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Standings Settings"
      description="Configure how the standings widget appears and behaves."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="standings"
    >
      {/* Add specific settings controls here */}
      <div className="text-slate-300">
        Additional settings will appear here
      </div>
    </BaseSettingsSection>
  );
}; 