import { ReactNode } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { BaseWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

interface BaseSettingsSectionProps<T extends BaseWidgetSettings> {
  title: string;
  description: string;
  settings: T;
  onSettingsChange: (settings: T) => void;
  widgetId: string;
  children?: ReactNode;
}

export const BaseSettingsSection = <T extends BaseWidgetSettings>({
  title,
  description,
  settings,
  onSettingsChange,
  widgetId,
  children,
}: BaseSettingsSectionProps<T>) => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();

  const handleSettingsChange = (newSettings: T) => {
    onSettingsChange(newSettings);
    
    if (currentDashboard && onDashboardUpdated) {
      const updatedDashboard = {
        ...currentDashboard,
        widgets: currentDashboard.widgets.map(widget => 
          widget.id === widgetId 
            ? { ...widget, enabled: newSettings.enabled }
            : widget
        )
      };
      onDashboardUpdated(updatedDashboard);
    }
  };

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
            onToggle={(enabled) => handleSettingsChange({ ...settings, enabled })}
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