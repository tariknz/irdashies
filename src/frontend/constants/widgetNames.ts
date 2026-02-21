/**
 * Mapping of widget IDs to their display names
 * Used for showing friendly names in Edit Mode and other UI elements
 */
export const WIDGET_NAMES: Record<string, string> = {
  standings: 'Standings',
  input: 'Input Traces',
  relative: 'Relative',
  map: 'Track Map',
  weather: 'Weather',
  flatmap: 'Flat Track Map',
  fastercarsfrombehind: 'Faster Cars From Behind',
  fuel: 'Fuel Calculator',
  blindspotmonitor: 'Blind Spot Monitor',
  garagecover: 'Garage Cover',
  rejoin: 'Rejoin Indicator',
  telemetryinspector: 'Telemetry Inspector',
  pitlanehelper: 'Pitlane Helper',
  flag: 'Flag',
};

/**
 * Get the display name for a widget ID
 * @param widgetId - The widget ID from the route
 * @returns The friendly display name, or the ID itself if not found
 */
export function getWidgetName(widgetId: string): string {
  return WIDGET_NAMES[widgetId] || widgetId;
}
