import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { RelativeWidgetSettings } from '../types';

export const RelativeSettings = () => {
  const [settings, setSettings] = useState<RelativeWidgetSettings>({
    enabled: false,
    // Add other settings here as needed
  });

  return (
    <BaseSettingsSection
      title="Relative Settings"
      description="Configure the relative timing display settings."
      settings={settings}
      onSettingsChange={(newSettings) => setSettings(newSettings as RelativeWidgetSettings)}
    >
      {/* Add specific settings controls here */}
      <div className="text-slate-300">
        Additional settings will appear here
      </div>
    </BaseSettingsSection>
  );
}; 