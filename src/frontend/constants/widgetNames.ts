import type { WidgetId } from '@irdashies/types';
import { WIDGET_MANIFESTS } from '@irdashies/types';

/**
 * Mapping of widget IDs to their display names
 * Used for showing friendly names in Edit Mode and other UI elements
 */
export const WIDGET_NAMES = Object.fromEntries(
  WIDGET_MANIFESTS.map(({ id, name }) => [id, name])
) as Record<WidgetId, string>;

/**
 * Get the display name for a widget ID
 * @param widgetId - The widget ID from the route
 * @returns The friendly display name, or the ID itself if not found
 */
export function getWidgetName(widgetId: string): string {
  return WIDGET_NAMES[widgetId as WidgetId] || widgetId;
}
