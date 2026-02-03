export interface BaseWidgetSettings<T = Record<string, unknown>> {
  enabled: boolean;
  config: T;
}

export interface SessionVisibilitySettings {
  race: boolean;
  loneQualify: boolean;
  openQualify: boolean;
  practice: boolean;
  offlineTesting: boolean;
}

export interface StandingsWidgetSettings extends BaseWidgetSettings {
  config: {
    iratingChange: { enabled: boolean };
    badge: { enabled: boolean; badgeFormat: 'license-color-fullrating-bw' | 'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license' };
    delta: { enabled: boolean };
    gap: { enabled: boolean };
    interval: { enabled: boolean };
    lastTime: {
      enabled: boolean;
      timeFormat:
      | 'full'
      | 'mixed'
      | 'minutes'
      | 'seconds-full'
      | 'seconds-mixed'
      | 'seconds';
    };
    fastestTime: {
      enabled: boolean;
      timeFormat:
      | 'full'
      | 'mixed'
      | 'minutes'
      | 'seconds-full'
      | 'seconds-mixed'
      | 'seconds';
    };
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
    carManufacturer: { enabled: boolean; hideIfSingleMake?: boolean };
    lapTimeDeltas: { enabled: boolean; numLaps: number };
    titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
    headerBar: {
      enabled: boolean;
      sessionName: { enabled: boolean };
      sessionTime: { enabled: boolean; mode: 'Remaining' | 'Elapsed' };
      sessionLaps: { enabled: boolean };
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
      sessionLaps: { enabled: boolean };
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
    useLivePosition: boolean;
    position: { enabled: boolean };
    driverName: { enabled: boolean; showStatusBadges: boolean; nameFormat: 'name-middlename-surname' | 'name-m.-surname' | 'name-surname' | 'n.-surname' | 'surname-n.' | 'surname' };
    teamName: { enabled: boolean };
    pitStatus: { enabled: boolean; showPitTime?: boolean; pitLapDisplayMode: 'lastPitLap' | 'lapsSinceLastPit' };
    displayOrder: string[];
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface RelativeWidgetSettings extends BaseWidgetSettings {
  config: {
    buffer: number;
    background: { opacity: number };
    countryFlags: { enabled: boolean };
    carNumber: { enabled: boolean };
    lastTime: {
      enabled: boolean;
      timeFormat:
      | 'full'
      | 'mixed'
      | 'minutes'
      | 'seconds-full'
      | 'seconds-mixed'
      | 'seconds';
    };
    fastestTime: {
      enabled: boolean;
      timeFormat:
      | 'full'
      | 'mixed'
      | 'minutes'
      | 'seconds-full'
      | 'seconds-mixed'
      | 'seconds';
    };
    compound: { enabled: boolean };
    carManufacturer: { enabled: boolean; hideIfSingleMake?: boolean };
    titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
    headerBar: {
      enabled: boolean;
      sessionName: { enabled: boolean };
      sessionTime: { enabled: boolean; mode: 'Remaining' | 'Elapsed' };
      sessionLaps: { enabled: boolean };
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
      sessionLaps: { enabled: boolean };
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
    badge: { enabled: boolean; badgeFormat: 'license-color-fullrating-bw' | 'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license' };
    iratingChange: { enabled: boolean };
    delta: {
      enabled: boolean;
      precision: number;
    };
    position: { enabled: boolean };
    driverName: { enabled: boolean; showStatusBadges: boolean; nameFormat: 'name-middlename-surname' | 'name-m.-surname' | 'name-surname' | 'n.-surname' | 'surname-n.' | 'surname' };
    teamName: { enabled: boolean };
    pitStatus: { enabled: boolean; showPitTime?: boolean; pitLapDisplayMode: 'lastPitLap' | 'lapsSinceLastPit' };
    displayOrder: string[];
    useLivePosition: boolean;
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface WeatherWidgetSettings extends BaseWidgetSettings {
  config: {
    background: { opacity: number };
    displayOrder: string[];
    showOnlyWhenOnTrack: boolean;
    airTemp: {
      enabled: boolean;
    };
    trackTemp: {
      enabled: boolean;
    };
    wetness: {
      enabled: boolean;
    };
    trackState: {
      enabled: boolean;
    };
    humidity: {
      enabled: boolean;
    };
    wind: {
      enabled: boolean;
    };
    units: 'auto' | 'Metric' | 'Imperial';
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface TrackMapWidgetSettings extends BaseWidgetSettings {
  config: {
    enableTurnNames: boolean;
    showCarNumbers: boolean;
    displayMode: 'carNumber' | 'sessionPosition';
    invertTrackColors: boolean;
    driverCircleSize: number;
    playerCircleSize: number;
    trackLineWidth: number;
    trackOutlineWidth: number;
    useHighlightColor: boolean;
    showOnlyWhenOnTrack: boolean;
    sessionVisibility: SessionVisibilitySettings;
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
      includeClutch: boolean;
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
    abs: {
      enabled: boolean;
    };
    steer: SteerWidgetSettings;
    tachometer: {
      enabled: boolean;
      showRpmText: boolean;
      shiftPointStyle?: 'glow' | 'pulse' | 'border';
      customShiftPoints?: {
        enabled: boolean;
        indicatorType: 'glow' | 'pulse' | 'border';
        indicatorColor: string;
        carConfigs: Record<string, {
          enabled: boolean;
          carId: string;
          carName: string;
          gearCount: number;
          redlineRpm: number;
          gearShiftPoints: Record<string, { shiftRpm: number }>;
        }>;
      };
    };
    background: { opacity: number };
    displayOrder: string[];
    showOnlyWhenOnTrack: boolean;
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface FuelWidgetSettings extends BaseWidgetSettings {
  config: {
    showOnlyWhenOnTrack: boolean;
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
    fuelRequiredMode: 'toFinish' | 'toAdd';
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface BlindSpotMonitorWidgetSettings extends BaseWidgetSettings {
  config: {
    showOnlyWhenOnTrack: boolean;
    background?: {
      opacity: number;
    };
    distAhead: number;
    distBehind: number;
    width?: number;
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface RejoinIndicatorWidgetSettings extends BaseWidgetSettings {
  config: {
    showAtSpeed: number;
    careGap: number;
    stopGap: number;
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface FlagWidgetSettings extends BaseWidgetSettings {
  id: 'flag';
  config: {
    enabled: boolean;
    showOnlyWhenOnTrack: boolean;
    showLabel: boolean;
    matrixMode: '8x8' | '16x16' | 'uniform';
    animate: boolean;
    blinkPeriod: number;
    showNoFlagState: boolean;
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface FlatTrackMapWidgetSettings extends BaseWidgetSettings {
  config: {
    showCarNumbers: boolean;
    displayMode: 'carNumber' | 'sessionPosition';
    driverCircleSize: number;
    playerCircleSize: number;
    trackLineWidth: number;
    trackOutlineWidth: number;
    invertTrackColors: boolean;
    useHighlightColor: boolean;
    showOnlyWhenOnTrack: boolean;
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface GarageCoverWidgetSettings extends BaseWidgetSettings {
  config: {
    imageFilename: string;
  };
}

export interface TelemetryInspectorWidgetSettings extends BaseWidgetSettings {
  config: {
    background?: { opacity: number };
    properties?: {
      source: 'telemetry' | 'session';
      path: string;
      label?: string;
    }[];
  };
}

export interface FasterCarsFromBehindWidgetSettings extends BaseWidgetSettings {
  config: {
    showOnlyWhenOnTrack: boolean;
    distanceThreshold: number;
    numberDriversBehind: number;
    alignDriverBoxes: 'Top' | 'Bottom';
    closestDriverBox: 'Top' | 'Reverse';
    showName: boolean;
    showDistance: boolean;
    showBadge: boolean;
    badgeFormat: string;
    sessionVisibility: SessionVisibilitySettings;
  };
}

export interface PitlaneHelperWidgetSettings extends BaseWidgetSettings {
  config: {
    showMode: 'approaching' | 'onPitRoad';
    approachDistance: number;
    enablePitLimiterWarning: boolean;
    enableEarlyPitboxWarning: boolean;
    earlyPitboxThreshold: number;
    showPitlaneTraffic: boolean;
    background: { opacity: number };
    progressBarOrientation: 'horizontal' | 'vertical';
    showPitExitInputs: boolean;
    pitExitInputs: {
      throttle: boolean;
      clutch: boolean;
    };
    showInputsPhase: 'atPitbox' | 'afterPitbox' | 'always';
  };
}

// Type for custom shift points - used in InputWidgetSettings tachometer config
export interface ShiftPointSettings {
  /** Whether custom shift points are enabled */
  enabled: boolean;
  /** Visual indicator type */
  indicatorType: 'glow' | 'pulse' | 'border';
  /** Indicator color */
  indicatorColor: string;
  /** Per-car shift configurations */
  carConfigs: Record<string, {
    carId: string;
    carName: string;
    gearCount: number;
    gearShiftPoints: Record<string, { shiftRpm: number }>;
  }>;
}
