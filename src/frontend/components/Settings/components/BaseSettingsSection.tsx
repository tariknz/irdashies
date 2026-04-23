import { ReactNode, useState } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { WidgetSettingsMap } from '@irdashies/types';
import { useDashboard } from '@irdashies/context';

interface BaseSettingsSectionProps<
  WidgetType extends keyof WidgetSettingsMap,
  TSettings extends WidgetSettingsMap[WidgetType],
  TConfig extends TSettings['config'],
  TVisibilityConfig extends TSettings['visibilityConfig'],
> {
  title: string;
  description: string;
  settings: TSettings;
  onSettingsChange: (settings: TSettings) => void;
  widgetType: WidgetType;
  widgetId?: string;
  children?:
    | ((
        handleConfigChange: (config: Partial<TConfig>) => void,
        handleVisibilityConfigChange: (
          config: Partial<TVisibilityConfig>
        ) => void
      ) => ReactNode)
    | ReactNode;
  disableInternalScroll?: boolean;
}

export const BaseSettingsSection = <
  WidgetType extends keyof WidgetSettingsMap,
  TSettings extends WidgetSettingsMap[WidgetType],
  TConfig extends TSettings['config'],
  TVisibilityConfig extends TSettings['visibilityConfig'],
>({
  title,
  description,
  widgetType,
  children,
  settings,
  onSettingsChange,
  widgetId = widgetType, // default to type if no specific ID given
  disableInternalScroll = false,
}: BaseSettingsSectionProps<
  WidgetType,
  TSettings,
  TConfig,
  TVisibilityConfig
>) => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const [localSettings, setLocalSettings] = useState<TSettings>(settings);

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
        ...settings,
        enabled: updatedWidget.enabled,
        config: updatedWidget.config as unknown as TConfig,
        visibilityConfig:
          updatedWidget.visibilityConfig as unknown as TVisibilityConfig,
      });
    }
  }

  const handleSettingsChange = (newSettings: TSettings) => {
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
    updateDashboard(newSettings);
  };

  const handleConfigChange = (newConfig: Partial<TConfig>) => {
    const updatedSettings: TSettings = {
      ...localSettings,
      config: {
        ...localSettings.config,
        ...newConfig,
      } as TConfig,
    };

    setLocalSettings(updatedSettings);
    onSettingsChange(updatedSettings);
    updateDashboard(updatedSettings);
  };

  const handleVisibilityConfigChange = (
    newConfig: Partial<TVisibilityConfig>
  ) => {
    const updatedSettings: TSettings = {
      ...localSettings,
      visibilityConfig: {
        ...localSettings.visibilityConfig,
        ...newConfig,
      } as TVisibilityConfig,
    };

    setLocalSettings(updatedSettings);
    onSettingsChange(updatedSettings);
    updateDashboard(updatedSettings);
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetPosition = () => {
    setShowResetConfirm(true);
  };

  const confirmResetPosition = () => {
    setShowResetConfirm(false);
    if (currentDashboard && onDashboardUpdated) {
      const updatedWidgets = currentDashboard.widgets.map((widget) => {
        if (widget.id !== widgetId) return widget;

        return {
          ...widget,
          layout: {
            ...widget.layout,
            x: 0,
            y: 0,
          },
          config: {
            ...widget.config,
            browserPosition: undefined,
          },
        };
      });

      const updatedDashboard = {
        ...currentDashboard,
        widgets: updatedWidgets,
      };
      onDashboardUpdated(updatedDashboard);
    }
  };

  const updateDashboard = (newSettings: TSettings) => {
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
              visibilityConfig:
                newSettings.visibilityConfig as unknown as Record<
                  string,
                  unknown
                >,
            };
          })
        : [
            ...currentDashboard.widgets,
            {
              id: widgetId,
              enabled: newSettings.enabled,
              config: newSettings.config as unknown as Record<string, unknown>,
              visibilityConfig:
                newSettings.visibilityConfig as unknown as Record<
                  string,
                  unknown
                >,
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

  if (!currentDashboard) {
    return <>Loading...</>;
  }

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
            />
          </div>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
      </div>

      <div
        className={`${disableInternalScroll ? '' : 'flex-1 overflow-y-auto min-h-0'} mt-4`}
      >
        {children && (
          <div className="space-y-4">
            {typeof children === 'function'
              ? children(handleConfigChange, handleVisibilityConfigChange)
              : children}
          </div>
        )}

        <div className="flex justify-center p-4 pt-2 mt-2">
          <button
            type="button"
            onClick={handleResetPosition}
            className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
          >
            Reset Position
          </button>
        </div>

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-slate-800 rounded-lg border border-slate-600 p-5 w-80 shadow-xl">
              <h3 className="text-base font-semibold text-white mb-2">
                Reset Position
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                This will reset the position for both the on-screen overlay and
                the browser/URL source version.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmResetPosition}
                  className="flex-1 px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors"
                >
                  Reset Position
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
