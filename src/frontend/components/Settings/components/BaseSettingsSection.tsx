import { ReactNode, useState } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { BaseWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';

interface BaseSettingsSectionProps<T> {
  title: string;
  description: string;
  settings: BaseWidgetSettings<T>;
  onSettingsChange: (settings: BaseWidgetSettings<T>) => void;
  widgetId: string;
  children?:
    | ((handleConfigChange: (config: Partial<T>) => void) => ReactNode)
    | ReactNode;
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
  const [localSettings, setLocalSettings] =
    useState<BaseWidgetSettings<T>>(settings);

  // Clean synchronization pattern: track what we last synced to detect external changes
  const updatedWidget = currentDashboard?.widgets.find(
    (w) => w.id === widgetId
  );
  const [prevWidgetData, setPrevWidgetData] = useState(updatedWidget);

  if (JSON.stringify(updatedWidget) !== JSON.stringify(prevWidgetData)) {
    setPrevWidgetData(updatedWidget);
    if (updatedWidget) {
      // This setState during render is safe and efficient in React when guarded by a condition
      // like this. It avoids the extra render pass that an effect would cause.
      setLocalSettings({
        enabled: updatedWidget.enabled,
        config: updatedWidget.config as unknown as T,
      });
    }
  }

  const handleSettingsChange = (newSettings: BaseWidgetSettings<T>) => {
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
    updateDashboard(newSettings);
  };

  const handleConfigChange = (newConfig: Partial<T>) => {
    const updatedSettings: BaseWidgetSettings<T> = {
      ...localSettings,
      config: {
        ...localSettings.config,
        ...newConfig,
      } as T,
    };

    setLocalSettings(updatedSettings);
    onSettingsChange(updatedSettings);
    updateDashboard(updatedSettings);
    onConfigChange?.(newConfig);
  };

  const updateDashboard = (newSettings: BaseWidgetSettings<T>) => {
    if (currentDashboard && onDashboardUpdated) {
      const widgetExists = currentDashboard.widgets.some(
        (w) => w.id === widgetId
      );

      const updatedWidgets = widgetExists
        ? currentDashboard.widgets.map((widget) => {
            if (widget.id !== widgetId) return widget;

            return {
              ...widget,
              enabled: newSettings.enabled,
              config: newSettings.config as unknown as Record<string, unknown>,
            };
          })
        : [
            ...currentDashboard.widgets,
            {
              id: widgetId,
              enabled: newSettings.enabled,
              config: newSettings.config as unknown as Record<string, unknown>,
              // Default layout for new widgets if they don't exist
              layout: { x: 50, y: 50, width: 400, height: 300 },
            },
          ];

      const updatedDashboard = {
        ...currentDashboard,
        widgets: updatedWidgets,
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
              onToggle={(enabled) =>
                handleSettingsChange({ ...settings, enabled })
              }
              label="Enable Widget"
            />
          </div>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
      </div>

      <div
        className={`${disableInternalScroll ? '' : 'flex-1 overflow-y-auto min-h-0'} mt-4`}
      >
        {children && (
          <div className="space-y-4 p-4">
            {typeof children === 'function'
              ? children(handleConfigChange)
              : children}
          </div>
        )}
      </div>
    </div>
  );
};
