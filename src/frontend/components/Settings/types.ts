export interface BaseWidgetSettings<T = Record<string, unknown>> {
  enabled: boolean;
  config: T;
}

export interface StandingsWidgetSettings extends BaseWidgetSettings {
  config: {
    iratingChange: { enabled: boolean };
    badge: { enabled: boolean; badgeFormat: 'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license' };
    delta: { enabled: boolean };
    gap: { enabled: boolean };
    interval: { enabled: boolean };
    lastTime: { enabled: boolean; timeFormat: 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds' };
    fastestTime: { enabled: boolean; timeFormat: 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds' };
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
    titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
    headerBar: {
      enabled: boolean;
      sessionName: { enabled: boolean };
      sessionTime: { enabled: boolean; mode: 'Remaining' | 'Elapsed' };
      incidentCount: { enabled: boolean };
      brakeBias: { enabled: boolean };
      localTime: { enabled: boolean };
      sessionClockTime: { enabled: boolean };
      trackWetness: { enabled: boolean };
      precipitation: { enabled: boolean };
      airTemperature: { enabled: boolean; unit: 'Metric' | 'Imperial' };
      trackTemperature: { enabled: boolean; unit: 'Metric' | 'Imperial' };
      displayOrder: string[];
    };
    footerBar: {
      enabled: boolean;
      sessionName: { enabled: boolean };
      sessionTime: { enabled: boolean; mode: 'Remaining' | 'Elapsed' };
      incidentCount: { enabled: boolean };
      brakeBias: { enabled: boolean };
      localTime: { enabled: boolean };
      sessionClockTime: { enabled: boolean };
      trackWetness: { enabled: boolean };
      precipitation: { enabled: boolean };
      airTemperature: { enabled: boolean; unit: 'Metric' | 'Imperial' };
      trackTemperature: { enabled: boolean; unit: 'Metric' | 'Imperial' };
      displayOrder: string[];
    };
    showOnlyWhenOnTrack: boolean;
    position: { enabled: boolean };
    driverName: { enabled: boolean };
    pitStatus: { enabled: boolean };
    displayOrder: string[];
  };
}

export interface RelativeWidgetSettings extends BaseWidgetSettings {
  config: {
    buffer: number;
    background: { opacity: number };
    countryFlags: { enabled: boolean };
    carNumber: { enabled: boolean };
    lastTime: { enabled: boolean; timeFormat: 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds' };
    fastestTime: { enabled: boolean; timeFormat: 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds' };
    compound: { enabled: boolean };
    carManufacturer: { enabled: boolean };
    titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
    headerBar: {
      enabled: boolean;
      sessionName: { enabled: boolean };
      sessionTime: { enabled: boolean; mode: 'Remaining' | 'Elapsed' };
      incidentCount: { enabled: boolean };
      brakeBias: { enabled: boolean };
      localTime: { enabled: boolean };
      sessionClockTime: { enabled: boolean };
      trackWetness: { enabled: boolean };
      precipitation: { enabled: boolean };
      airTemperature: { enabled: boolean; unit: 'Metric' | 'Imperial' };
      trackTemperature: { enabled: boolean; unit: 'Metric' | 'Imperial' };
      displayOrder: string[];
    };
    footerBar: {
      enabled: boolean;
      sessionName: { enabled: boolean };
      sessionTime: { enabled: boolean; mode: 'Remaining' | 'Elapsed' };
      incidentCount: { enabled: boolean };
      brakeBias: { enabled: boolean };
      localTime: { enabled: boolean };
      sessionClockTime: { enabled: boolean };
      trackWetness: { enabled: boolean };
      precipitation: { enabled: boolean };
      airTemperature: { enabled: boolean; unit: 'Metric' | 'Imperial' };
      trackTemperature: { enabled: boolean; unit: 'Metric' | 'Imperial' };
      displayOrder: string[];
    };
    showOnlyWhenOnTrack: boolean;
    badge: { enabled: boolean; badgeFormat: 'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license' };
    iratingChange: { enabled: boolean };
    delta: { enabled: boolean };
    position: { enabled: boolean };
    driverName: { enabled: boolean };
    pitStatus: { enabled: boolean };
    displayOrder: string[];
    enhancedGapCalculation: {
      enabled: boolean;
      interpolationMethod: 'linear' | 'cubic';
      sampleInterval: number;
      maxLapHistory: number;
    };
  };
}

export interface WeatherWidgetSettings extends BaseWidgetSettings {
  config: {
    background: { opacity: number };
    airTemp: {
      enabled: boolean
    };
    trackTemp: {
      enabled: boolean
    };
    wetness: {
      enabled: boolean
    };
    trackState: {
      enabled: boolean
    };
    wind: { enabled: boolean };
    units: 'auto' | 'Metric' | 'Imperial';
  };
};

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
      strokeWidth?: number;
      maxSamples?: number;
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
    tachometer: {
      enabled: boolean;
      showRpmText: boolean;
    };
    background: { opacity: number };
    displayOrder: string[];
    showOnlyWhenOnTrack: boolean;
  };
}

export interface FuelWidgetSettings extends BaseWidgetSettings {
  config: {
    fuelUnits: 'L' | 'gal';
    layout: 'vertical' | 'horizontal';
    showConsumption: boolean;
    showMin: boolean;
    showLastLap: boolean;
    show3LapAvg: boolean;
    show10LapAvg: boolean;
    showMax: boolean;
    showPitWindow: boolean;
    showEnduranceStrategy: boolean;
    showFuelScenarios: boolean;
    showFuelRequired: boolean;
    showConsumptionGraph: boolean;
    consumptionGraphType: 'line' | 'histogram';
    safetyMargin: number;
    background: { opacity: number };
  };
}

export interface BlindSpotMonitorWidgetSettings extends BaseWidgetSettings {
  config: {
    background?: {
      opacity: number;
    };
    distAhead: number;
    distBehind: number;
    width?: number;
  };
}
