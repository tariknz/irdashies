import { ReactNode } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { BaseWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

interface BaseSettingsSectionProps<T> {
  title: string;
  description: string;
  settings: BaseWidgetSettings<T>;
  onSettingsChange: (settings: BaseWidgetSettings<T>) => void;
  widgetId: string;
  children?: ((handleConfigChange: (config: Partial<T>) => void) => ReactNode) | ReactNode;
  onConfigChange?: (config: Partial<T>) => void;
  disableInternalScroll?: boolean;
}

export const BaseSettingsSection = <T,>({
  title,
  description,
  settings,
  onSettingsChange,
  widgetId,
  children,
  onConfigChange,
  disableInternalScroll = false,
}: BaseSettingsSectionProps<T>) => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();

  const handleSettingsChange = (newSettings: BaseWidgetSettings<T>) => {
    onSettingsChange(newSettings);
    updateDashboard(newSettings);
  };

  const handleConfigChange = (newConfig: Partial<T>) => {
    const updatedSettings: BaseWidgetSettings<T> = {
      ...settings,
      config: {
        ...settings.config,
        ...newConfig,
      } as T,
    };

    onSettingsChange(updatedSettings);
    updateDashboard(updatedSettings);
    onConfigChange?.(newConfig);
  };

  const updateDashboard = (newSettings: BaseWidgetSettings<T>) => {
    if (currentDashboard && onDashboardUpdated) {
      const updatedDashboard = {
        ...currentDashboard,
        widgets: currentDashboard.widgets.map(widget =>
          widget.id === widgetId
            ? {
                ...widget,
                enabled: newSettings.enabled,
                config: newSettings.config as unknown as Record<string, unknown>
              }
            : widget
        )
      };
      onDashboardUpdated(updatedDashboard);
    }
  };

  return (
    <div className={`flex flex-col ${disableInternalScroll ? '' : 'h-full'}`}>
      <div className="flex-none space-y-6 p-4 bg-slate-700 rounded">
        <div>
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xl">{title}</h2>
            <ToggleSwitch
              enabled={settings.enabled}
              onToggle={(enabled) => handleSettingsChange({ ...settings, enabled })}
              label="Enable Widget"
            />
          </div>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
      </div>

      <div className={`${disableInternalScroll ? '' : 'flex-1 overflow-y-auto min-h-0'} mt-4`}>
        {children && (
          <div className="space-y-4 p-4">
            {typeof children === 'function' ? children(handleConfigChange) : children}
          </div>
        )}
      </div>
    </div>
  );
}; 