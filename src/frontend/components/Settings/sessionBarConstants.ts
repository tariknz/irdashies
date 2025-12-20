// Valid keys for headerBar and footerBar items (session bar components)
export const VALID_SESSION_BAR_ITEM_KEYS = ['sessionName', 'sessionTime', 'incidentCount', 'brakeBias', 'localTime', 'trackWetness', 'airTemperature', 'trackTemperature'] as const;

// Labels for session bar items
export const SESSION_BAR_ITEM_LABELS: Record<string, string> = {
  sessionName: 'Session Name',
  sessionTime: 'Session Time',
  incidentCount: 'Incident Count',
  brakeBias: 'Brake Bias',
  localTime: 'Local Time',
  trackWetness: 'Track Wetness',
  airTemperature: 'Air Temperature',
  trackTemperature: 'Track Temperature'
};

// Default display order for session bar items (same for headerBar and footerBar)
export const DEFAULT_SESSION_BAR_DISPLAY_ORDER = [...VALID_SESSION_BAR_ITEM_KEYS];
