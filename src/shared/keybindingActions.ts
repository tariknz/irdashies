import type { WidgetToggleActionId } from '@irdashies/types';

/**
 * Prefix marking a keybinding action as a per-widget show/hide toggle. The text
 * after the prefix is the widget instance id, e.g. `toggle-widget:standings`.
 */
export const WIDGET_TOGGLE_PREFIX = 'toggle-widget:';

/** True when an action id is a dynamic per-widget toggle. */
export function isWidgetToggleActionId(
  actionId: string
): actionId is WidgetToggleActionId {
  return actionId.startsWith(WIDGET_TOGGLE_PREFIX);
}

/** Build the toggle action id for a widget instance id. */
export function widgetToggleActionId(widgetId: string): WidgetToggleActionId {
  return `${WIDGET_TOGGLE_PREFIX}${widgetId}`;
}

/** Extract the widget instance id from a toggle action id. */
export function widgetIdFromToggleActionId(
  actionId: WidgetToggleActionId
): string {
  return actionId.slice(WIDGET_TOGGLE_PREFIX.length);
}
