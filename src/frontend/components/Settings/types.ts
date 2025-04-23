export interface BaseWidgetSettings {
  enabled: boolean;
}

export interface StandingsWidgetSettings extends BaseWidgetSettings {
  // Add specific standings settings here
}

export interface RelativeWidgetSettings extends BaseWidgetSettings {
  // Add specific relative settings here
}

export interface WeatherWidgetSettings extends BaseWidgetSettings {
  // Add specific weather settings here
}

export interface TrackMapWidgetSettings extends BaseWidgetSettings {
  // Add specific track map settings here
}

export interface InputWidgetSettings extends BaseWidgetSettings {
  showThrottle: boolean;
  showBrake: boolean;
  showClutch: boolean;
  opacity: number;
}

export interface AdvancedSettings extends BaseWidgetSettings {
  // Add specific advanced settings here
} 