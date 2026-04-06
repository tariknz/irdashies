import type { DashboardWidget } from './dashboardLayout';
import { nameof } from '@irdashies/utils/nameof';

// ===========================
// Shared primitive types
// ===========================

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
// Shared visibility config types
// ===========================

export type NoVisibilityConfig = object;

export interface SessionVisibilityConfig {
  sessionVisibility: {
    race: boolean;
    loneQualify: boolean;
    openQualify: boolean;
    practice: boolean;
    offlineTesting: boolean;
  };
}

export interface OnTrackVisibilityConfig {
  showOnlyWhenOnTrack: boolean;
}

export const isSessionVisibilityConfig = (
  object: unknown
): object is SessionVisibilityConfig =>
  typeof object === 'object' &&
  object !== null &&
  nameof<SessionVisibilityConfig>('sessionVisibility') in object;

export const isOnTrackVisibilityConfig = (
  object: unknown
): object is OnTrackVisibilityConfig =>
  typeof object === 'object' &&
  object !== null &&
  nameof<OnTrackVisibilityConfig>('showOnlyWhenOnTrack') in object;

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
// Styling option types
// ===========================

export interface StylingOptions {
  badge?: boolean;
  statusBadges?: boolean;
  driverPosition?: { background?: boolean };
  driverNumber?: { background?: boolean; border?: boolean };
}

export interface ClassHeaderStyle {
  className?: { colorBackground?: boolean };
  classInfo?: { colorBackground?: boolean };
  classDivider?: { bottomBorder?: boolean };
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
  avgLapTime: { enabled: boolean; numLaps: number; timeFormat: TimeFormat };
  titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
  headerBar: SessionBarConfig;
  footerBar: SessionBarConfig;
  useLivePosition?: boolean;
  position: { enabled: boolean };
  driverName: DriverNameConfig;
  teamName: { enabled: boolean };
  pitStatus: PitStatusConfig;
  driverTag: { enabled: boolean; widthPx?: number };
  displayOrder: string[];
  stylingOptions?: StylingOptions;
  classHeaderStyle?: ClassHeaderStyle;
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
  badge: { enabled: boolean; badgeFormat: RelativeBadgeFormat };
  iratingChange: { enabled: boolean };
  positionChange?: { enabled: boolean };
  delta: { enabled: boolean; precision: number };
  position: { enabled: boolean };
  driverName: DriverNameConfig;
  teamName: { enabled: boolean };
  pitStatus: PitStatusConfig;
  driverTag: { enabled: boolean; widthPx?: number };
  displayOrder: string[];
  useLivePosition?: boolean;
  stylingOptions?: StylingOptions;
}

export interface WeatherConfig {
  background: { opacity: number };
  displayOrder: string[];
  airTemp: { enabled: boolean };
  trackTemp: { enabled: boolean };
  wetness: { enabled: boolean };
  trackState: { enabled: boolean };
  precipitation: { enabled: boolean };
  wind: { enabled: boolean };
  units: 'auto' | 'Metric' | 'Imperial';
}

export interface TrackMapConfig {
  turnLabels: {
    enabled: boolean;
    labelType: 'names' | 'numbers' | 'both';
    highContrast: boolean;
    labelFontSize: number;
  };
  showCarNumbers: boolean;
  displayMode?: 'carNumber' | 'sessionPosition' | 'livePosition';
  invertTrackColors: boolean;
  driverCircleSize: number;
  playerCircleSize: number;
  trackmapFontSize: number;
  trackLineWidth: number;
  trackOutlineWidth: number;
  useHighlightColor: boolean;
  styling?: { isMinimalTrack?: boolean; isMinimalCar?: boolean };
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
    size: number;
    unit: 'mph' | 'km/h' | 'auto';
    showspeed: boolean;
    showspeedunit: boolean;
  };
  abs: { enabled: boolean };
  steer: {
    enabled: boolean;
    config: SteerConfig;
  };
  background: { opacity: number };
  displayOrder: string[];
}

export interface TachometerConfig {
  showRpmText: boolean;
  rpmOrientation?: 'horizontal' | 'bottom' | 'top';
  shiftPointStyle?: 'glow' | 'pulse' | 'border';
  shiftPointSettings: {
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
  };
  background: { opacity: number };
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
  background?: { opacity: number };
  distAhead: number;
  distBehind: number;
  width?: number;
  borderSize?: number;
  indicatorColor?: number;
}

export interface RejoinIndicatorConfig {
  showAtSpeed: number;
  careGap: number;
  stopGap: number;
  clearGap?: number;
  width?: number;
}

export interface FlagConfig {
  enabled?: boolean;
  showLabel: boolean;
  matrixMode: '8x8' | '16x16' | 'uniform';
  animate: boolean;
  blinkPeriod: number;
  showNoFlagState: boolean;
  enableGlow: boolean;
  doubleFlag?: boolean;
}

export interface GarageCoverConfig {
  imageFilename: string;
}

export interface TelemetryInspectorPropertyConfig {
  source: 'telemetry' | 'session';
  path: string;
  label?: string;
}

export interface TelemetryInspectorConfig {
  background?: { opacity: number };
  properties?: TelemetryInspectorPropertyConfig[];
}

export interface FasterCarsFromBehindConfig {
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
  showSpeedSummary: boolean;
  showSpeedDelta: boolean;
  speedUnit?: 'mph' | 'km/h' | 'auto';
  speedLimitStyle?: 'none' | 'text' | 'european' | 'american';
  showPitExitInputs?: boolean;
  pitExitInputs?: { throttle: boolean; clutch: boolean };
  showInputsPhase?: 'atPitbox' | 'afterPitbox' | 'always';
}

export interface TwitchChatConfig {
  fontSize: number;
  channel: string;
  background: { opacity: number };
}

export interface LapTimeLogConfig {
  showCurrentLap: boolean;
  showPredictedLap: boolean;
  showLastLap: boolean;
  showBestLap: boolean;
  delta: {
    enabled: boolean;
    method: 'lastlap' | 'bestlap';
  };
  history: {
    enabled: boolean;
    count: number;
  };
  scale: number;
  alignment: 'top' | 'bottom';
  reverse: boolean;
  background: { opacity: number };
  foreground: { opacity: number };
}

export interface SlowCarAheadConfig {
  maxDistance: number;
  slowSpeedThreshold: number;
  stoppedSpeedThreshold: number;
  barThickness: number;
}

export interface InformationBarConfig extends SessionBarConfig {
  background: { opacity: number };
}

// ===========================
// Widget settings map + typed widget
// ===========================

export interface WidgetSettingsMap {
  standings: StandingsWidgetSettings;
  relative: RelativeWidgetSettings;
  weather: WeatherWidgetSettings;
  map: TrackMapWidgetSettings;
  flatmap: FlatTrackMapWidgetSettings;
  input: InputWidgetSettings;
  tachometer: TachometerWidgetSettings;
  fuel: FuelWidgetSettings;
  blindspotmonitor: BlindSpotMonitorWidgetSettings;
  garagecover: GarageCoverWidgetSettings;
  rejoin: RejoinIndicatorWidgetSettings;
  flag: FlagWidgetSettings;
  telemetryinspector: TelemetryInspectorWidgetSettings;
  fastercarsfrombehind: FasterCarsFromBehindWidgetSettings;
  pitlanehelper: PitlaneHelperWidgetSettings;
  twitchchat: TwitchChatWidgetSettings;
  laptimelog: LapTimeLogWidgetSettings;
  infobar: InformationBarWidgetSettings;
  slowcarahead: SlowCarAheadWidgetSettings;
}

/**
 * Use the WidgetSettingsMap to generate a WidgetConfigMap, mapping the widget type to the widget config.
 */
export type WidgetConfigMap<
  K extends keyof WidgetSettingsMap = keyof WidgetSettingsMap,
> = {
  [Id in K]: WidgetSettingsMap[Id]['config'];
};

export type TypedDashboardWidget<
  K extends keyof WidgetConfigMap = keyof WidgetConfigMap,
> = {
  [Id in K]: Omit<DashboardWidget, 'id' | 'config' | 'visibilityConfig'> & {
    id: Id;
    config: WidgetSettingsMap[Id]['config'] & Record<string, unknown>;
    visibilityConfig: WidgetSettingsMap[Id]['visibilityConfig'] &
      Record<string, unknown>;
  };
}[K];

// ===========================
// Widget settings wrappers
// ===========================

export interface BaseWidgetSettings<
  TConfig = Record<string, unknown>,
  TVisibilityConfig = NoVisibilityConfig,
> {
  id?: string;
  type?: string;
  enabled: boolean;
  config: TConfig;
  visibilityConfig: TVisibilityConfig;
}

/** Available settings tabs */
export type SettingsTabType =
  | 'display'
  | 'options'
  | 'visibility'
  | 'styling'
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

/** Settings without visibility config */
export type SteerWidgetSettings = BaseWidgetSettings<SteerConfig>;
export type GarageCoverWidgetSettings = BaseWidgetSettings<GarageCoverConfig>;
export type TelemetryInspectorWidgetSettings =
  BaseWidgetSettings<TelemetryInspectorConfig>;
export type TwitchChatWidgetSettings = BaseWidgetSettings<TwitchChatConfig>;

/** Settings with visibility config */
export type StandingsWidgetSettings = BaseWidgetSettings<
  StandingsConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type RelativeWidgetSettings = BaseWidgetSettings<
  RelativeConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type WeatherWidgetSettings = BaseWidgetSettings<
  WeatherConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type TrackMapWidgetSettings = BaseWidgetSettings<
  TrackMapConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type FlatTrackMapWidgetSettings = BaseWidgetSettings<
  FlatTrackMapConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type InputWidgetSettings = BaseWidgetSettings<
  InputConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type TachometerWidgetSettings = BaseWidgetSettings<
  TachometerConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type FuelWidgetSettings = BaseWidgetSettings<
  FuelConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type BlindSpotMonitorWidgetSettings = BaseWidgetSettings<
  BlindSpotMonitorConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type RejoinIndicatorWidgetSettings = BaseWidgetSettings<
  RejoinIndicatorConfig,
  SessionVisibilityConfig
>;
export type FlagWidgetSettings = BaseWidgetSettings<
  FlagConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type FasterCarsFromBehindWidgetSettings = BaseWidgetSettings<
  FasterCarsFromBehindConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type PitlaneHelperWidgetSettings = BaseWidgetSettings<
  PitlaneHelperConfig,
  SessionVisibilityConfig
>;
export type LapTimeLogWidgetSettings = BaseWidgetSettings<
  LapTimeLogConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type InformationBarWidgetSettings = BaseWidgetSettings<
  InformationBarConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
export type SlowCarAheadWidgetSettings = BaseWidgetSettings<
  SlowCarAheadConfig,
  SessionVisibilityConfig & OnTrackVisibilityConfig
>;
