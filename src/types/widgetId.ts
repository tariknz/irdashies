import type { WidgetConfigMap } from './widgetConfigs';

/** Id of a built-in widget type; derived from the widget config map. */
export type WidgetId = keyof WidgetConfigMap;
