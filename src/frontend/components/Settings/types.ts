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
    countryFlags: { enabled: boolean };
    carNumber: { enabled: boolean };
    driverStandings: {
      buffer: number;
      numNonClassDrivers: number;
      minPlayerClassDrivers: number;
      numTopDrivers: number;
    };
    compound: { enabled: boolean };
    carManufacturer: { enabled: boolean };
    lapTimeDeltas: { enabled: boolean; numLaps: number };
  };
}

export interface RelativeWidgetSettings extends BaseWidgetSettings {
  config: {
    buffer: number;
    background: { opacity: number };
    countryFlags: { enabled: boolean };
    carNumber: { enabled: boolean };
    lastTime: { enabled: boolean };
    fastestTime: { enabled: boolean };
    compound: { enabled: boolean };
    carManufacturer: { enabled: boolean };
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

export interface SteerWidgetSettings extends BaseWidgetSettings {
  config: {
    style: 'formula' | 'lmp' | 'nascar' | 'ushape' | 'default';
    color: 'dark' | 'light';
  };
}

export interface InputWidgetSettings extends BaseWidgetSettings {
  config: {
    trace: {
      enabled: boolean;
      includeThrottle: boolean;
      includeBrake: boolean;
      includeAbs: boolean;
      includeSteer?: boolean;
    };
    bar: {
      enabled: boolean;
      includeClutch: boolean;
      includeBrake: boolean;
      includeThrottle: boolean;
      includeAbs: boolean;
    };
    gear: {
      enabled: boolean;
      unit: 'mph' | 'km/h' | 'auto';
    };
    steer: SteerWidgetSettings;
  };
}

export interface FuelWidgetSettings extends BaseWidgetSettings {
  config: {
    fuelUnits: 'L' | 'gal';
    showConsumption: boolean;
    showMin: boolean;
    showLastLap: boolean;
    show3LapAvg: boolean;
    show10LapAvg: boolean;
    showMax: boolean;
    showPitWindow: boolean;
    showFuelSave: boolean;
    safetyMargin: number;
    background: { opacity: number };
  };
}
