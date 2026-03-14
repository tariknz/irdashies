import type { DashboardWidget } from './dashboardLayout';

// ===========================
// Shared primitive types
// ===========================

export interface SessionVisibilitySettings {
  race: boolean;
  loneQualify: boolean;
  openQualify: boolean;
  practice: boolean;
  offlineTesting: boolean;
}

export type TimeFormat =
  | 'full'
  | 'mixed'
  | 'minutes'
  | 'seconds-full'
  | 'seconds-mixed'
  | 'seconds';

export type NameFormat =
  | 'name-middlename-surname'
  | 'name-m.-surname'
  | 'name-surname'
  | 'n.-surname'
  | 'surname-n.'
  | 'surname';

export type TemperatureUnit = 'Metric' | 'Imperial';

// ===========================
// Shared widget config sub-types
// ===========================

export interface DriverNameConfig {
  enabled: boolean;
  showStatusBadges: boolean;
  removeNumbersFromName: boolean;
  nameFormat?: NameFormat;
}

export interface PitStatusConfig {
  enabled: boolean;
  showPitTime?: boolean;
  pitLapDisplayMode: 'lastPitLap' | 'lapsSinceLastPit';
}

export interface SessionBarConfig {
  enabled: boolean;
  sessionName: { enabled: boolean };
  sessionTime: {
    enabled: boolean;
    mode: 'Remaining' | 'Elapsed';
    totalFormat?: 'hh:mm' | 'minimal';
    labelStyle?: 'none' | 'short' | 'minimal';
  };
  sessionLaps: { enabled: boolean; mode?: 'Elapsed' | 'Remaining' };
  incidentCount: { enabled: boolean };
  brakeBias: { enabled: boolean };
  localTime: { enabled: boolean };
  sessionClockTime: { enabled: boolean };
  trackWetness: { enabled: boolean };
  precipitation?: { enabled: boolean };
  airTemperature: { enabled: boolean; unit: TemperatureUnit };
  trackTemperature: { enabled: boolean; unit: TemperatureUnit };
  wind?: { enabled: boolean; speedPosition?: 'left' | 'right' };
  trackName: { enabled: boolean };
  displayOrder: string[];
}

// ===========================
// Badge format types
// ===========================

export type StandingsBadgeFormat =
  | 'license-color-fullrating-combo'
  | 'fullrating-color-no-license'
  | 'rating-color-no-license'
  | 'license-color-fullrating-bw'
  | 'license-color-rating-bw'
  | 'rating-only-color-rating-bw'
  | 'license-color-rating-bw-no-license'
  | 'license-bw-rating-bw'
  | 'rating-only-bw-rating-bw'
  | 'license-bw-rating-bw-no-license'
  | 'rating-bw-no-license'
  | 'fullrating-bw-no-license';

export type RelativeBadgeFormat =
  | 'license-color-fullrating-combo'
  | 'fullrating-color-no-license'
  | 'license-color-fullrating-bw'
  | 'license-color-rating-bw'
  | 'license-color-rating-bw-no-license'
  | 'rating-color-no-license'
  | 'license-bw-rating-bw'
  | 'rating-only-bw-rating-bw'
  | 'license-bw-rating-bw-no-license'
  | 'rating-bw-no-license'
  | 'fullrating-bw-no-license';

// ===========================
// Widget config types
// ===========================

export interface StandingsConfig {
  iratingChange: { enabled: boolean };
  positionChange: { enabled: boolean };
  badge: { enabled: boolean; badgeFormat: StandingsBadgeFormat };
  delta: { enabled: boolean };
  gap: { enabled: boolean; decimalPlaces?: number };
  interval: { enabled: boolean; decimalPlaces?: number };
  lastTime: { enabled: boolean; timeFormat: TimeFormat };
  fastestTime: { enabled: boolean; timeFormat: TimeFormat };
  background: { opacity: number };
  countryFlags: { enabled: boolean };
  carNumber: { enabled: boolean };
  driverStandings: {
    buffer: number;
    numNonClassDrivers: number;
    minPlayerClassDrivers: number;
    numTopDrivers: number;
    topDriverDivider?: 'none' | 'theme' | 'highlight';
  };
  compound: { enabled: boolean };
  carManufacturer: { enabled: boolean; hideIfSingleMake?: boolean };
  lapTimeDeltas: { enabled: boolean; numLaps: number };
  titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
  headerBar: SessionBarConfig;
  footerBar: SessionBarConfig;
  showOnlyWhenOnTrack: boolean;
  useLivePosition?: boolean;
  position: { enabled: boolean };
  driverName: DriverNameConfig;
  teamName: { enabled: boolean };
  pitStatus: PitStatusConfig;
  displayOrder: string[];
  sessionVisibility: SessionVisibilitySettings;
}

export interface RelativeConfig {
  buffer: number;
  background: { opacity: number };
  countryFlags: { enabled: boolean };
  carNumber: { enabled: boolean };
  lastTime: { enabled: boolean; timeFormat: TimeFormat };
  fastestTime: { enabled: boolean; timeFormat: TimeFormat };
  compound: { enabled: boolean };
  carManufacturer: { enabled: boolean; hideIfSingleMake?: boolean };
  titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
  headerBar: SessionBarConfig;
  footerBar: SessionBarConfig;
  showOnlyWhenOnTrack: boolean;
  badge: { enabled: boolean; badgeFormat: RelativeBadgeFormat };
  iratingChange: { enabled: boolean };
  positionChange?: { enabled: boolean };
  delta: { enabled: boolean; precision: number };
  position: { enabled: boolean };
  driverName: DriverNameConfig;
  teamName: { enabled: boolean };
  pitStatus: PitStatusConfig;
  displayOrder: string[];
  useLivePosition?: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface WeatherConfig {
  background: { opacity: number };
  displayOrder: string[];
  showOnlyWhenOnTrack?: boolean;
  airTemp: { enabled: boolean };
  trackTemp: { enabled: boolean };
  wetness: { enabled: boolean };
  trackState: { enabled: boolean };
  humidity: { enabled: boolean };
  wind: { enabled: boolean };
  units: 'auto' | 'Metric' | 'Imperial';
  sessionVisibility: SessionVisibilitySettings;
}

export interface TrackMapConfig {
  enableTurnNames: boolean;
  showCarNumbers: boolean;
  displayMode?: 'carNumber' | 'sessionPosition' | 'livePosition';
  invertTrackColors: boolean;
  highContrastTurns: boolean;
  driverCircleSize: number;
  playerCircleSize: number;
  trackmapFontSize: number;
  trackLineWidth: number;
  trackOutlineWidth: number;
  useHighlightColor: boolean;
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface FlatTrackMapConfig {
  showCarNumbers: boolean;
  displayMode: 'carNumber' | 'sessionPosition' | 'livePosition';
  driverCircleSize: number;
  playerCircleSize: number;
  trackmapFontSize: number;
  trackLineWidth: number;
  trackOutlineWidth: number;
  invertTrackColors: boolean;
  useHighlightColor: boolean;
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface SteerConfig {
  style: 'formula' | 'lmp' | 'nascar' | 'ushape' | 'default';
  color: 'dark' | 'light';
}

export interface InputConfig {
  useRawValues: boolean;
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
    unit: 'mph' | 'km/h' | 'auto' | 'none';
    showspeed: boolean;
  };
  abs?: { enabled: boolean };
  steer: {
    enabled: boolean;
    config: SteerConfig;
  };
  background: { opacity: number };
  displayOrder: string[];
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface TachometerConfig {  
  showRpmText: boolean;
  rpmOrientation?: 'horizontal' | 'vertical'
  shiftPointStyle?: 'glow' | 'pulse' | 'border';
  shiftPointSettings: {
    enabled: boolean,
    indicatorType: 'glow' | 'pulse' | 'border';
    indicatorColor: string,
    carConfigs: Record<
      string,
      {
        enabled: boolean;
        carId: string;
        carName: string;
        gearCount: number;
        redlineRpm: number;
        gearShiftPoints: Record<string, { shiftRpm: number }>;
      }
    >;
  },  
  background: { opacity: number };
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export type LayoutDirection = 'row' | 'col';

export type LayoutNode =
  | {
      id: string;
      type: 'box';
      widgets: string[];
      direction: LayoutDirection;
      weight?: number;
    }
  | {
      id: string;
      type: 'split';
      direction: LayoutDirection;
      children: LayoutNode[];
      weight?: number;
    };

export interface BoxConfig {
  id: string;
  flow?: 'vertical' | 'horizontal';
  width?: '1/1' | '1/2' | '1/3' | '1/4';
  widgets: string[];
}

export interface FuelConfig {
  showOnlyWhenOnTrack: boolean;
  fuelUnits: 'L' | 'gal';
  layout: 'vertical' | 'horizontal';
  showConsumption: boolean;
  showFuelLevel: boolean;
  showLapsRemaining: boolean;
  showMin: boolean;
  showCurrentLap: boolean;
  showQualifyConsumption?: boolean;
  showLastLap: boolean;
  show3LapAvg: boolean;
  show10LapAvg: boolean;
  showMax: boolean;
  showPitWindow: boolean;
  showEnduranceStrategy: boolean;
  showFuelScenarios: boolean;
  showFuelRequired: boolean;
  showFuelHistory: boolean;
  fuelHistoryType: 'line' | 'histogram';
  safetyMargin: number;
  manualTarget?: number;
  background: { opacity: number };
  fuelRequiredMode: 'toFinish' | 'toAdd';
  enableTargetPitLap?: boolean;
  targetPitLap?: number;
  targetPitLapBasis?: 'avg' | 'avg10' | 'last' | 'max' | 'min' | 'qual';
  economyPredictMode?: 'live' | 'endOfLap';
  useGeneralFontSize?: boolean;
  useGeneralCompactMode?: boolean;
  sessionVisibility: SessionVisibilitySettings;
  layoutConfig?: BoxConfig[];
  layoutTree?: LayoutNode;
  widgetStyles?: Record<
    string,
    {
      fontSize?: number;
      labelFontSize?: number;
      valueFontSize?: number;
      barFontSize?: number;
      height?: number;
    }
  >;
  consumptionGridOrder?: string[];
  fuelStatusThresholds?: { green: number; amber: number; red: number };
  fuelStatusBasis?: 'last' | 'avg' | 'min' | 'max';
  fuelStatusRedLaps?: number;
  avgLapsCount?: number;
  enableStorage?: boolean;
  enableLogging?: boolean;
  showFuelStatusBorder?: boolean;
}

export interface BlindSpotMonitorConfig {
  showOnlyWhenOnTrack?: boolean;
  background?: { opacity: number };
  distAhead: number;
  distBehind: number;
  width?: number;
  sessionVisibility: SessionVisibilitySettings;
}

export interface RejoinIndicatorConfig {
  showAtSpeed: number;
  careGap: number;
  stopGap: number;
  clearGap?: number;
  width?: number;
  sessionVisibility: SessionVisibilitySettings;
}

export interface FlagConfig {
  enabled?: boolean;
  showOnlyWhenOnTrack: boolean;
  showLabel: boolean;
  matrixMode: '8x8' | '16x16' | 'uniform';
  animate: boolean;
  blinkPeriod: number;
  showNoFlagState: boolean;
  enableGlow: boolean;
  doubleFlag?: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface GarageCoverConfig {
  imageFilename: string;
}

export interface TelemetryInspectorConfig {
  background?: { opacity: number };
  properties?: {
    source: 'telemetry' | 'session';
    path: string;
    label?: string;
  }[];
}

export interface FasterCarsFromBehindConfig {
  showOnlyWhenOnTrack?: boolean;
  distanceThreshold: number;
  numberDriversBehind?: number;
  alignDriverBoxes?: 'Top' | 'Bottom';
  closestDriverBox?: 'Top' | 'Reverse';
  showName?: boolean;
  removeNumbersFromName?: boolean;
  showDistance?: boolean;
  showBadge?: boolean;
  badgeFormat?: string;
  onlyShowFasterClasses: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface PitlaneHelperConfig {
  showMode: 'approaching' | 'onPitRoad';
  approachDistance: number;
  enablePitLimiterWarning: boolean;
  enableEarlyPitboxWarning: boolean;
  earlyPitboxThreshold: number;
  showPitlaneTraffic: boolean;
  background: { opacity: number };
  progressBarOrientation?: 'horizontal' | 'vertical';
  speedBarOrientation?: 'horizontal' | 'vertical';
  showPastPitBox?: boolean;
  showProgressBar?: boolean;
  showSpeedBar?: boolean;
  showPitExitInputs?: boolean;
  pitExitInputs?: { throttle: boolean; clutch: boolean };
  showInputsPhase?: 'atPitbox' | 'afterPitbox' | 'always';
  sessionVisibility: SessionVisibilitySettings;
}

export interface TwitchChatConfig {
  fontSize: number;
  channel: string;
  background: { opacity: number };
}

// ===========================
// Widget config map + typed widget
// ===========================

export interface WidgetConfigMap {
  standings: StandingsConfig;
  relative: RelativeConfig;
  weather: WeatherConfig;
  map: TrackMapConfig;
  flatmap: FlatTrackMapConfig;
  input: InputConfig;
  tachometer: TachometerConfig;
  fuel: FuelConfig;
  blindspotmonitor: BlindSpotMonitorConfig;
  garagecover: GarageCoverConfig;
  rejoin: RejoinIndicatorConfig;
  flag: FlagConfig;
  telemetryinspector: TelemetryInspectorConfig;
  fastercarsfrombehind: FasterCarsFromBehindConfig;
  pitlanehelper: PitlaneHelperConfig;
  twitchchat: TwitchChatConfig;
}

export type TypedDashboardWidget<
  K extends keyof WidgetConfigMap = keyof WidgetConfigMap,
> = {
  [Id in K]: Omit<DashboardWidget, 'id' | 'config'> & {
    id: Id;
    config: WidgetConfigMap[Id] & Record<string, unknown>;
  };
}[K];

// ===========================
// Widget settings wrappers
// ===========================

export interface BaseWidgetSettings<T = Record<string, unknown>> {
  id?: string;
  type?: string;
  enabled: boolean;
  config: T;
}

/** Available settings tabs */
export type SettingsTabType =
  | 'display'
  | 'options'
  | 'visibility'
  | 'track'
  | 'drivers'
  | 'layout'
  | 'header'
  | 'footer'
  | 'history'
  | 'telemetry'
  | 'dashboard';

/** Available widgets for the Fuel Calculator */
export type FuelWidgetType =
  | 'fuelLevel'
  | 'lapsRemaining'
  | 'fuelHeader'
  | 'consumption'
  | 'pitWindow'
  | 'endurance'
  | 'scenarios'
  | 'graph'
  | 'confidence'
  | 'keyInfo';

export interface ShiftPointSettings {
  enabled: boolean;
  indicatorType: 'glow' | 'pulse' | 'border';
  indicatorColor: string;
  carConfigs: Record<
    string,
    {
      enabled: boolean;
      carId: string;
      carName: string;
      gearCount: number;
      redlineRpm: number;
      gearShiftPoints: Record<string, { shiftRpm: number }>;
    }
  >;
}

export type StandingsWidgetSettings = BaseWidgetSettings<StandingsConfig>;
export type RelativeWidgetSettings = BaseWidgetSettings<RelativeConfig>;
export type WeatherWidgetSettings = BaseWidgetSettings<WeatherConfig>;
export type TrackMapWidgetSettings = BaseWidgetSettings<TrackMapConfig>;
export type FlatTrackMapWidgetSettings = BaseWidgetSettings<FlatTrackMapConfig>;
export type SteerWidgetSettings = BaseWidgetSettings<SteerConfig>;
export type InputWidgetSettings = BaseWidgetSettings<InputConfig>;
export type TachometerWidgetSettings = BaseWidgetSettings<TachometerConfig>;
export type FuelWidgetSettings = BaseWidgetSettings<FuelConfig>;
export type BlindSpotMonitorWidgetSettings =
  BaseWidgetSettings<BlindSpotMonitorConfig>;
export type RejoinIndicatorWidgetSettings =
  BaseWidgetSettings<RejoinIndicatorConfig>;
export type FlagWidgetSettings = BaseWidgetSettings<FlagConfig> & {
  id: 'flag';
};
export type GarageCoverWidgetSettings = BaseWidgetSettings<GarageCoverConfig>;
export type TelemetryInspectorWidgetSettings =
  BaseWidgetSettings<TelemetryInspectorConfig>;
export type FasterCarsFromBehindWidgetSettings =
  BaseWidgetSettings<FasterCarsFromBehindConfig>;
export type PitlaneHelperWidgetSettings =
  BaseWidgetSettings<PitlaneHelperConfig>;
export type TwitchChatWidgetSettings = BaseWidgetSettings<TwitchChatConfig>;
