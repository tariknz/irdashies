import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { InputWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

export const InputSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<InputWidgetSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === 'input')?.enabled ?? false,
    showThrottle: true,
    showBrake: true,
    showClutch: true,
    opacity: 0.8,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Input Traces Settings"
      description="Configure the input traces display settings for throttle, brake, and clutch."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="input"
    >
      <div className="text-slate-300">
        Additional settings will appear here
      </div>
    </BaseSettingsSection>
  );
};
