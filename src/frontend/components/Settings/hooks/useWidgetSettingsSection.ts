import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultSettings,
  SettingsTabType,
  WidgetSettingsMap,
} from '@irdashies/types';
import { useEffect, useState } from 'react';

/**
 * A hook providing state and data for the settings of a particular widget.
 * @param widgetType the widget type to retrieve settings for.
 * @param widgetId the widget ID to retrieve settings for. Defaults to the widgetType if not provided.
 * @param defaultOverride Overrides the default settings that would otherwise be used via {@link getWidgetDefaultSettings}
 */
export const useWidgetSettingsSection = <
  TWidget extends keyof WidgetSettingsMap,
  TSettings extends WidgetSettingsMap[TWidget],
>(
  widgetType: TWidget,
  widgetId: string = widgetType, // default to type if not specific id given
  defaultOverride?: TSettings | (() => TSettings)
) => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === widgetId
  ) as TSettings | undefined;

  const defaultSettings = getWidgetDefaultSettings(widgetType);
  const [settings, setSettings] = useState<TSettings>(
    (savedSettings as TSettings) ??
      (typeof defaultOverride === 'function'
        ? defaultOverride()
        : defaultOverride) ??
      defaultSettings
  );

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem(`${widgetId}Tab`) as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem(`${widgetId}Tab`, activeTab);
  }, [activeTab, widgetId]);

  return { settings, setSettings, activeTab, setActiveTab };
};
