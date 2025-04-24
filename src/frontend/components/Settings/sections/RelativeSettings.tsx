import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { RelativeWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

export const RelativeSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<RelativeWidgetSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === 'relative')?.enabled ?? false,
    // Add other settings here as needed
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
      {/* Add specific settings controls here */}
      <div className="text-slate-300">
        Additional settings will appear here
      </div>
    </BaseSettingsSection>
  );
}; 