import { ReactNode } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { BaseWidgetSettings } from '../types';

interface BaseSettingsSectionProps {
  title: string;
  description: string;
  settings: BaseWidgetSettings;
  onSettingsChange: (settings: BaseWidgetSettings) => void;
  children?: ReactNode;
}

export const BaseSettingsSection = ({
  title,
  description,
  settings,
  onSettingsChange,
  children,
}: BaseSettingsSectionProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl mb-4">{title}</h2>
        <p className="text-slate-400">{description}</p>
      </div>

      <div className="space-y-4">
        <div className="border-b border-slate-700 pb-4">
          <ToggleSwitch
            enabled={settings.enabled}
            onToggle={(enabled) => onSettingsChange({ ...settings, enabled })}
            label="Enable Widget"
          />
        </div>

        {children && (
          <div className="pt-4 space-y-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}; 