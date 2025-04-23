import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { InputWidgetSettings } from '../types';

export const InputSettings = () => {
  const [settings, setSettings] = useState<InputWidgetSettings>({
    enabled: false,
    showThrottle: true,
    showBrake: true,
    showClutch: true,
    opacity: 0.8,
  });

  return (
    <BaseSettingsSection
      title="Input Traces Settings"
      description="Configure the input traces display settings for throttle, brake, and clutch."
      settings={settings}
      onSettingsChange={(newSettings) =>
        setSettings(newSettings as InputWidgetSettings)
      }
    >
      <div className="text-slate-300">
        Additional settings will appear here
      </div>
    </BaseSettingsSection>
  );
};
