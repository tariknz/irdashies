import type { WidgetId } from '../WidgetIndex';

/**
 * Mapping of widget IDs to their display names
 * Used for showing friendly names in Edit Mode and other UI elements
 */
export const WIDGET_NAMES: Record<WidgetId, string> = {
  standings: 'Standings',
  input: 'Input Traces',
  relative: 'Relative',
  map: 'Track Map',
  flatmap: 'Flat Track Map',
  weather: 'Weather',
  fastercarsfrombehind: 'Faster Cars From Behind',
  fuel: 'Fuel Calculator',
  fuel2: 'Fuel Calculator 2',
  blindspotmonitor: 'Blind Spot Monitor',
  garagecover: 'Garage Cover',
  rejoin: 'Rejoin Indicator',
};

/**
 * Get the display name for a widget ID
 * @param widgetId - The widget ID from the route
 * @returns The friendly display name, or the ID itself if not found
 */
export function getWidgetName(widgetId: string): string {
  return WIDGET_NAMES[widgetId] || widgetId;
}
