export interface BaseWidgetSettings<T = Record<string, unknown>> {
  enabled: boolean;
  config: T;
}

export interface StandingsWidgetSettings extends BaseWidgetSettings {
  config: {
    iRatingChange: { enabled: boolean };
    badge: { enabled: boolean };
    delta: { enabled: boolean };
    lastTime: { enabled: boolean };
    fastestTime: { enabled: boolean };
    background: { opacity: number };
    driverStandings: {
      buffer: number;
      numNonClassDrivers: number;
      minPlayerClassDrivers: number;
      numTopDrivers: number;
    };
  };
}

export interface RelativeWidgetSettings extends BaseWidgetSettings {
  config: {
    buffer: number;
    background: { opacity: number };
  };
}

export interface WeatherWidgetSettings extends BaseWidgetSettings {
  config: {
    background: { opacity: number };
  };
}

export interface TrackMapWidgetSettings extends BaseWidgetSettings {
  config: {
    enableTurnNames: boolean;
  };
}

export interface InputWidgetSettings extends BaseWidgetSettings {
  config: {
    trace: {
      enabled: boolean;
      includeThrottle: boolean;
      includeBrake: boolean;
    };
    bar: {
      enabled: boolean;
      includeClutch: boolean;
      includeBrake: boolean;
      includeThrottle: boolean;
    };
    gear: {
      enabled: boolean;
      unit: 'mph' | 'km/h' | 'auto';
    };
    steer: {
      enabled: boolean;
    };
  };
}

/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface AdvancedSettings extends BaseWidgetSettings {
  // Add specific advanced settings here
}