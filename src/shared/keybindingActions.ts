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

/**
 * True when an action id is a widget toggle with a non-empty widget id. Use at
 * boundaries (storage merge, IPC) to reject malformed `toggle-widget:` keys.
 */
export function isValidWidgetToggleActionId(actionId: string): boolean {
  return (
    isWidgetToggleActionId(actionId) &&
    widgetIdFromToggleActionId(actionId).length > 0
  );
}

/**
 * Target index when cycling profiles. Returns -1 when at an edge and cycle is
 * off (i.e. no switch should happen).
 */
export const nextProfileIndex = (
  currentIndex: number,
  length: number,
  direction: 1 | -1,
  cycle: boolean
): number => {
  if (length === 0) return -1;
  const start = currentIndex === -1 ? 0 : currentIndex;
  const next = start + direction;
  if (cycle) return (next + length) % length;
  if (next < 0 || next >= length) return -1;
  return next;
};
