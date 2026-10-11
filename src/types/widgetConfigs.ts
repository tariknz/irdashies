import type { DashboardWidget } from './dashboardLayout';
import type { CornerNameOverlayConfig } from './cornerName';
import type { LapTraceColors, LapTraceSound, LapTraceSource } from './lapTrace';

// ===========================
// Shared primitive types
// ===========================

export interface SessionVisibilitySettings {
  race: boolean;
  loneQualify: boolean;
  openQualify: boolean;
  practice: boolean;
  offlineTesting: boolean;
  /** Optional: only widgets that offer it save it; unset shows the widget. */
  warmup?: boolean;
}

export type TimeFormat =
  | 'full'
  | 'mixed'
  | 'minutes'
  | 'seconds-full'
  | 'seconds-2'
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
  fuelLevel?: { enabled: boolean };
  lastLap?: { enabled: boolean };
  bestLap?: { enabled: boolean };
  topSpeed?: { enabled: boolean };
  manufacturerPosition?: {
    enabled: boolean;
    hideIfSingleMake?: boolean;
    hideIfSingleDriver?: boolean;
  };
  classRank?: { enabled: boolean };
  displayOrder: string[];
  foreground?: { opacity: number };
}

// ===========================
// Styling option types
// ===========================

export interface StylingOptions {
  badge?: boolean;
  statusBadges?: boolean;
  columnHeaders?: { enabled: boolean };
  driverPosition?: { background?: boolean };
  driverNumber?: { background?: boolean; border?: boolean };
  lapCount?: { minimal?: boolean };
  flagContour?: {
    enabled?: boolean;
    borderWidth?: number;
  };
}

export interface ClassHeaderStyle {
  className?: { colorBackground?: boolean };
  classInfo?: { colorBackground?: boolean };
  classDivider?: { bottomBorder?: boolean };
  compactSof?: boolean;
  manufacturerStats?: {
    enabled: boolean;
    cap: number | null; // null = All
    showPlayerManufacturer: boolean;
  };
  estimatedLaps?: { enabled: boolean; numLaps?: number };
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
  customClassOrdering: boolean;
  scale?: number;
  iratingChange: { enabled: boolean; estimateInPractice?: boolean };
  positionChange: { enabled: boolean };
  badge: { enabled: boolean; badgeFormat: StandingsBadgeFormat };
  delta: { enabled: boolean };
  gap: { enabled: boolean; decimalPlaces?: number };
  interval: { enabled: boolean; decimalPlaces?: number };
  lastTime: { enabled: boolean; timeFormat: TimeFormat };
  fastestTime: { enabled: boolean; timeFormat: TimeFormat };
  background: { opacity: number };
  foreground?: { opacity: number };
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
  radio?: { persistenceSeconds: number };
  lapTimeDeltas: { enabled: boolean; numLaps: number; decimalPlaces: number };
  avgLapTime: { enabled: boolean; numLaps: number; timeFormat: TimeFormat };
  lapCount: { enabled: boolean };
  titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
  headerBar: SessionBarConfig;
  footerBar: SessionBarConfig;
  showOnlyWhenOnTrack: boolean;
  useLivePosition?: boolean;
  position: { enabled: boolean };
  driverName: DriverNameConfig & { subtext?: 'none' | 'teamName' };
  teamName: { enabled: boolean; subtext?: 'none' | 'driverName' };
  pitStatus: PitStatusConfig;
  pushToPass: { enabled: boolean };
  driverTag: { enabled: boolean; widthPx?: number };
  displayOrder: string[];
  sessionVisibility: SessionVisibilitySettings;
  stylingOptions?: StylingOptions;
  classHeaderStyle?: ClassHeaderStyle;
}

export interface RelativeConfig {
  buffer: number;
  background: { opacity: number };
  foreground?: { opacity: number };
  countryFlags: { enabled: boolean };
  carNumber: { enabled: boolean };
  lastTime: { enabled: boolean; timeFormat: TimeFormat };
  fastestTime: { enabled: boolean; timeFormat: TimeFormat };
  compound: { enabled: boolean };
  carManufacturer: { enabled: boolean; hideIfSingleMake?: boolean };
  radio?: { persistenceSeconds: number };
  titleBar: { enabled: boolean; progressBar: { enabled: boolean } };
  headerBar: SessionBarConfig;
  footerBar: SessionBarConfig;
  showOnlyWhenOnTrack: boolean;
  /**
   * Hides drivers sitting in their pit stall (TrackLocation.InPitStall) so they
   * stop scrolling through the relative while being serviced or waiting for
   * repairs. Drivers driving down pit road (entering or exiting) still show.
   */
  hideDriversInPitStall?: boolean;
  badge: { enabled: boolean; badgeFormat: RelativeBadgeFormat };
  iratingChange: { enabled: boolean };
  positionChange?: { enabled: boolean };
  delta: { enabled: boolean; precision: number };
  position: { enabled: boolean };
  driverName: DriverNameConfig;
  teamName: { enabled: boolean };
  pitStatus: PitStatusConfig;
  pushToPass: { enabled: boolean };
  driverTag: { enabled: boolean; widthPx?: number };
  lapTimeDeltas: { enabled: boolean; numLaps: number; decimalPlaces: number };
  displayOrder: string[];
  useLivePosition?: boolean;
  sessionVisibility: SessionVisibilitySettings;
  stylingOptions?: StylingOptions;
}

export interface WeatherConfig {
  background: { opacity: number };
  layout?: 'vertical' | 'horizontal';
  horizontalMode?: 'compact' | 'full';
  displayOrder: string[];
  showOnlyWhenOnTrack?: boolean;
  airTemp: { enabled: boolean };
  trackTemp: { enabled: boolean };
  humidity: { enabled: boolean };
  wetness: { enabled: boolean };
  trackState: { enabled: boolean };
  precipitation: { enabled: boolean };
  wind: { enabled: boolean };
  units: 'auto' | 'Metric' | 'Imperial';
  sessionVisibility: SessionVisibilitySettings;
}

export interface WindConfig {
  background: { opacity: number };
  units: 'auto' | 'Metric' | 'Imperial';
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
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
  invertLeaderColor: boolean;
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
  styling?: { isMinimalTrack?: boolean; isMinimalCar?: boolean };
  sectorColoring?: {
    enabled: boolean;
  };
  playerIcon?: { enabled: boolean; fileName: string };
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
  invertLeaderColor: boolean;
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface SteerConfig {
  style: 'formula' | 'lmp' | 'nascar' | 'ushape' | 'default' | 'ring';
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
    /** 'overlay' draws a wider stroke on top of the brake curve; 'bar' fills the area under the curve to y=0 */
    absStyle?: 'overlay' | 'bar';
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
    /** Swap the speed number and the km/h unit (order + emphasis). Default false. */
    swapSpeedUnit?: boolean;
  };
  abs: { enabled: boolean };
  steer: {
    enabled: boolean;
    config: SteerConfig;
  };
  background: { opacity: number };
  displayOrder: string[];
  /** When set, decides which elements show and where. Supersedes the enabled flags and displayOrder. */
  layoutTree?: LayoutNode;
  /** Flash the whole layout at the redline or at the Tachometer custom shift points. */
  shiftFlash?: {
    enabled: boolean;
    source: 'redline' | 'shiftPoints';
    color: string;
  };
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
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
  oilTemp?: {
    enabled: boolean;
    position: 'top' | 'bottom';
    /** 0-100: slide the oil box from the edge toward the centre. */
    edgeOffset?: number;
  };
  waterTemp?: {
    enabled: boolean;
    position: 'top' | 'bottom';
    /** 0-100: slide the water box from the edge toward the centre. */
    edgeOffset?: number;
  };
  /**
   * Shared layout for the oil/water temperature boxes.
   * `swapSides` flips which side each box sits on (default: oil left, water right).
   */
  tempLayout?: { swapSides: boolean };
  background: { opacity: number };
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}
export interface ShiftLightConfig {
  showRpmText: boolean;
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
  borderSize?: number;
  indicatorColor?: number;
  sessionVisibility: SessionVisibilitySettings;
  displayMode?: 'standard' | 'simple';
  simpleSize?: number;
  simpleVerticalPosition?: number;
  simpleShowCount?: boolean;
  thresholdColorsEnabled?: boolean;
  thresholdColor1?: number;
  thresholdColor2?: number;
}

/**
 * How a warning marks the rim: a solid arc, three segments that light up
 * with urgency, a soft glow inward from the rim, or a wedge from our car.
 */
export const RADAR_ARC_STYLES = ['arc', 'segments', 'glow', 'sector'] as const;
export type RadarArcStyle = (typeof RADAR_ARC_STYLES)[number];

/** Where along our car a rival must reach to be owed room. */
export const RADAR_OVERLAP_THRESHOLDS = [
  'rearWheel',
  'door',
  'frontWheel',
] as const;
export type RadarOverlapThreshold = (typeof RADAR_OVERLAP_THRESHOLDS)[number];

export const RADAR_RIVAL_COLOR_MODES = ['safety', 'class', 'custom'] as const;

export interface RadarConfig {
  /** Metres from the centre to the edge of the disc. */
  range: number;
  /** Keep the radar off screen while no rival is near. */
  autoHide: boolean;
  /** Metres; a rival this close brings the radar on screen. */
  showDistance: number;
  /**
   * Metres; the radar leaves once every rival is further than this. Kept
   * above `showDistance` so a car sitting on the threshold cannot make it
   * blink.
   */
  hideDistance: number;
  /** Seconds the fade in and out takes. */
  fadeSeconds: number;
  /**
   * Car body size in metres; the SDK reports none. Used for every car when
   * `sizeByClass` is off, and for unknown classes when it is on.
   */
  carLength: number;
  carWidth: number;
  /** Size cars by class: saved overrides, then typical sizes per class. */
  sizeByClass: boolean;
  /** Per-class size overrides keyed by CarClassShortName. */
  classSizes: Record<string, { length: number; width: number }>;
  /** Rim arcs and outlines for close and alongside rivals. */
  showWarnings: boolean;
  /** The rim arc of a close or alongside rival; off leaves the outline. */
  warningArcs: boolean;
  warningArcStyle: RadarArcStyle;
  /** Metres of bumper gap below which a rival is drawn as close. */
  cautionDistance: number;
  /** Write the bumper gap next to a close rival. */
  showGapLabel: boolean;
  showCarNumbers: boolean;
  /** Draw the road under the cars. */
  showTrackMap: boolean;
  /** Drawn road width in metres; the drawings carry no width. */
  trackWidth: number;
  /** Road opacity, 0-100. */
  mapOpacity: number;
  showRings: boolean;
  /** Metres between distance rings. */
  ringSpacing: number;
  /** Hide cars on pit road while we are on track, and the reverse. */
  hideInPit: boolean;
  /** Keep the radar off screen while our car sits in its pit box. */
  hideInPitBox: boolean;
  /**
   * Rival fill: their licence colour as on the rating badge, their class
   * colour, or one colour for everyone.
   */
  rivalColorMode: (typeof RADAR_RIVAL_COLOR_MODES)[number];
  /** Colour for `custom`; null picks a paler shade of `playerColor`. */
  rivalCustomColor: number | null;
  playerColor: number;
  background: { opacity: number };
  /** Share of the radius, 0-100, over which the radar fades out at the rim. */
  edgeFade: number;
  /** Dashed lines through our car, ahead/behind and left/right. */
  showCrosshair: boolean;
  /** Run the dashes of the line ahead/behind past at our speed. */
  axisMotion: boolean;
  /** Metres of each dash on the moving line; the gaps are twice as long. */
  axisDashLength: number;
  /** Speed of the moving dashes, % of our own. */
  axisSpeed: number;
  closeColor: number;
  alongsideColor: number;
  /** Pulses per second on cars alongside; 0 keeps them steady. */
  pulseHz: number;
  /**
   * Degrees either side of the bearing the arc of a close or alongside car
   * spans, at least/most.
   */
  arcMinDeg: number;
  arcMaxDeg: number;
  /** Thickness of every rim arc, % of the radius. */
  arcThickness: number;
  /**
   * A strip along the side a rival is on, showing how far along our car it
   * reaches (or how far along its car we reach when we attack).
   */
  showOverlap: boolean;
  /** How far alongside counts as owed room: the strip turns red from there. */
  overlapThreshold: RadarOverlapThreshold;
  /** Write the overlap in per cent next to the strip. */
  overlapShowPercent: boolean;
  /** Warn early about a car coming up fast from behind and diving in. */
  showDiveWarning: boolean;
  /** Closing speed in km/h below which a car behind is no worry. */
  diveMinClosingKmh: number;
  /** Seconds to our side under which a fast car turns into a dive warning. */
  diveWarnSeconds: number;
  /** Draw where a diving car will be shortly, as a dashed outline. */
  diveGhost: boolean;
  /** Write the closing speed (and time to our side) next to a fast car. */
  diveShowClosing: boolean;
  /** The rim arc of a car coming up fast or diving in. */
  diveArcs: boolean;
  diveArcStyle: RadarArcStyle;
  diveArcMinDeg: number;
  diveArcMaxDeg: number;
  /** Mark cars ahead that crashed, crawl, left the track or are rejoining. */
  showHazards: boolean;
  /** Metres ahead a hazard is shown from. */
  hazardRange: number;
  /** Metres under which the hazard marker flashes. */
  hazardBlinkDistance: number;
  hazardCrash: boolean;
  hazardSlow: boolean;
  /** Cars off the track, and coming back on. */
  hazardOff: boolean;
  /** Write what happened (CRASH, SLOW, OFF, REJOIN) before the distance. */
  hazardShowLabel: boolean;
  /** Write the hazard car's speed under its distance. */
  hazardShowSpeed: boolean;
  /** The rim arc under a hazard's triangle. */
  hazardArcs: boolean;
  hazardArcStyle: RadarArcStyle;
  /** Half-span of a hazard's arc far off and right at the rim, degrees. */
  hazardArcMinDeg: number;
  hazardArcMaxDeg: number;
  /** Switch to `ovalProfile` on oval tracks. */
  autoProfile: boolean;
  /** Look and distances for ovals; null until the oval profile is edited. */
  ovalProfile: Partial<RadarProfileConfig> | null;
  tuning: RadarTuning;
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

/** Settings that the road and oval profiles each keep their own copy of. */
export const RADAR_PROFILE_KEYS = [
  'range',
  'autoHide',
  'showDistance',
  'hideDistance',
  'fadeSeconds',
  'showWarnings',
  'warningArcs',
  'warningArcStyle',
  'cautionDistance',
  'showGapLabel',
  'showCarNumbers',
  'showTrackMap',
  'trackWidth',
  'mapOpacity',
  'showRings',
  'ringSpacing',
  'showCrosshair',
  'axisMotion',
  'axisDashLength',
  'axisSpeed',
  'rivalColorMode',
  'rivalCustomColor',
  'playerColor',
  'background',
  'edgeFade',
  'closeColor',
  'alongsideColor',
  'pulseHz',
  'arcMinDeg',
  'arcMaxDeg',
  'arcThickness',
  'showOverlap',
  'overlapThreshold',
  'overlapShowPercent',
  'showDiveWarning',
  'diveMinClosingKmh',
  'diveWarnSeconds',
  'diveGhost',
  'diveShowClosing',
  'diveArcs',
  'diveArcStyle',
  'diveArcMinDeg',
  'diveArcMaxDeg',
  'showHazards',
  'hazardRange',
  'hazardBlinkDistance',
  'hazardArcs',
  'hazardArcStyle',
  'hazardArcMinDeg',
  'hazardArcMaxDeg',
] as const satisfies readonly (keyof RadarConfig)[];

export type RadarProfileKey = (typeof RADAR_PROFILE_KEYS)[number];
export type RadarProfileConfig = Pick<RadarConfig, RadarProfileKey>;

/** The part of the radar tuning the telemetry processor reads. */
export type RadarProcessorTuning = Pick<
  RadarTuning,
  | 'speedSmoothing'
  | 'laneRate'
  | 'overlapSearchM'
  | 'poleLearnAfterS'
  | 'poleFlipFrames'
  | 'gridMaxSpeedMs'
>;

export const DEFAULT_RADAR_TUNING: RadarTuning = {
  extrapolationS: 0.15,
  laneGapM: 0.7,
  minLabelPx: 8,
  debugLabels: false,
  showFrameTime: false,
  speedSmoothing: 0.25,
  laneRate: 4,
  overlapSearchM: 8,
  poleLearnAfterS: 15,
  poleFlipFrames: 30,
  gridMaxSpeedMs: 3,
};

/** Internals for the dev view; the defaults are what the radar was tuned on. */
export interface RadarTuning {
  /** Seconds a snapshot is extrapolated at most before the next arrives. */
  extrapolationS: number;
  /** Gap between lane centres beyond the car's own width, in metres. */
  laneGapM: number;
  /** Car numbers are left out on cars drawn smaller than this, in px. */
  minLabelPx: number;
  /** Write car index and lane next to every car. */
  debugLabels: boolean;
  /** Write how long a frame takes to draw. */
  showFrameTime: boolean;
  /** Weight of the newest sample in the per-car speed average, 0-1. */
  speedSmoothing: number;
  /** Lanes per second a car may move when it changes lane. */
  laneRate: number;
  /** Metres either side searched for an overlapping car. */
  overlapSearchM: number;
  /** Seconds after the green flag in which the pole side is learnt. */
  poleLearnAfterS: number;
  /** Frames in a row the spotter must disagree before the side flips. */
  poleFlipFrames: number;
  /** Below this speed, in m/s, cars count as parked on the grid. */
  gridMaxSpeedMs: number;
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
  background?: { opacity: number };
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
  showSpeedSummary: boolean;
  showSpeedDelta: boolean;
  speedUnit?: 'mph' | 'km/h' | 'auto';
  speedLimitStyle?: 'none' | 'text' | 'european' | 'american';
  showPitExitInputs?: boolean;
  pitExitInputs?: { throttle: boolean; clutch: boolean };
  showInputsPhase?: 'atPitbox' | 'afterPitbox' | 'always';
  sessionVisibility: SessionVisibilitySettings;
}

export interface TwitchChatConfig {
  fontSize: number;
  channel: string;
  background: { opacity: number };
  autoHide: { enabled: boolean; intervalSeconds: number };
}

export interface HeartRateConfig {
  /** HypeRate session/device id — the code at the end of your share link (e.g. "KiY"). */
  deviceId: string;
  /**
   * Optional HypeRate widget URL or name (e.g. "Bouncing_Heart_Widget" or
   * "https://app.hyperate.io/animation/59/YOUR-ID-HERE"). The session id is
   * substituted in automatically. Blank uses the default overlay.
   */
  widgetUrl: string;
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface LapTimeLogConfig {
  showCurrentLap: boolean;
  showPredictedLap: boolean;
  showLastLap: boolean;
  showBestLap: boolean;
  showAllTimeLap: boolean;
  delta: {
    enabled: boolean;
    method: 'lastlap' | 'bestlap';
  };
  history: {
    enabled: boolean;
    count: number;
    style?: 'list' | 'chart';
    /**
     * Leave laps that involved a pit stop out of the history. They are far
     * slower than a green lap, so they stretch the chart scale and drag the
     * average, which flattens the laps you are actually comparing.
     */
    hidePittedLaps?: boolean;
  };
  scale: number;
  alignment: 'top' | 'bottom';
  reverse: boolean;
  background: { opacity: number };
  foreground: { opacity: number };
  sessionVisibility: SessionVisibilitySettings;
  showOnlyWhenOnTrack: boolean;
}

export interface SlowCarAheadConfig {
  maxDistance: number;
  slowSpeedThreshold: number;
  stoppedSpeedThreshold: number;
  barThickness: number;
  showOnlyWhenOnTrack?: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface SectorDeltaConfig {
  background: { opacity: number };
  timeFormat: TimeFormat;
  /**
   * Whether to compare against the ghost lap (when loaded) or always use
   * session best.
   *
   * 'prefer-ghost'      – use ghost lap when available, fall back to session best
   * 'session-best-only' – always compare against session best
   */
  ghostComparison: 'prefer-ghost' | 'session-best-only';
  /**
   * Whether to record and display sectors that contained an incident (x).
   * true  – record the sector time and show a warning icon
   * false – discard the sector time entirely (keeps previous best)
   * Defaults to true when omitted.
   */
  trackIncidentSectors?: boolean;
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
  /**
   * Custom color thresholds as percentages of session best.
   * Set to null to use defaults (green: 0.5%, yellow: 1.0%).
   */
  thresholds?: {
    green: number; // e.g. 0.5 means within 0.5% → green
    yellow: number; // e.g. 1.0 means within 1.0% → yellow; above = red
  } | null;
  /**
   * Maximum number of sector cards to show at once. When the track has more
   * sectors than this, the widget becomes a sliding carousel centered on the
   * current sector. Set to null to always show all sectors.
   */
  maxSectorsShown?: number | null;
  /**
   * Always use the continuous-scroll mode, even when all sectors fit in the
   * widget. The center line stays pinned to your exact track position.
   */
  alwaysScroll?: boolean;
}

/**
 * In-car systems readout.
 *
 * `rows` is an explicit ordered list of telemetry keys rather than a set of
 * booleans, so the rows keep a fixed screen position and a car that lacks one
 * shows a blank in place rather than shifting everything up.
 */
export interface CarSystemsConfig {
  rows: string[];
  /** Blank rows for adjustments the current car does not have. */
  showUnsupportedRows: boolean;
  /**
   * Rows for systems the driver has switched off, which read 0 on an unsigned
   * scale. Separate from `showUnsupportedRows`: a car that lacks a system and a
   * driver who turned one off are different facts, and a driver who wants only
   * live readings wants both gone.
   */
  showOffRows: boolean;
  background: { opacity: number };
  sessionVisibility: SessionVisibilitySettings;
  showOnlyWhenOnTrack: boolean;
}

export interface DeltaSpeedConfig {
  background: { opacity: number };
  /**
   * Display unit. Speeds are held in km/h throughout and converted only for
   * display. 'auto' follows iRacing's own DisplayUnits setting.
   */
  unit: 'km/h' | 'mph' | 'auto';
  /**
   * Delta at which the background reaches full colour, in km/h. Held per unit
   * rather than converted so both caps stay whole numbers — converting a 15
   * km/h cap would give an awkward 9.3 mph.
   */
  scaleKph: number;
  /** Delta at which the background reaches full colour, in mph. */
  scaleMph: number;
  /**
   * Largest delta shown numerically, in km/h. Past this the readout holds at
   * the cap instead of climbing: an exact figure only helps while the
   * correction is still worth making, and a wide delta is already obvious from
   * the colour. Held per unit for the same reason as the scales above.
   */
  capKph: number;
  /** Largest delta shown numerically, in mph. */
  capMph: number;
  /**
   * The readout holds its current value until the true delta has moved at
   * least this far, in km/h. Without it the last digit flickers between
   * neighbouring values while the delta is essentially steady, which draws the
   * eye for no reason.
   */
  updateThresholdKph: number;
  /** Update threshold applied when displaying mph. */
  updateThresholdMph: number;
  /** Show the numeric delta inside the box. */
  showNumber: boolean;
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface BattleConfig {
  background: { opacity: number };
  showOnlyWhenOnTrack: boolean;
  position: { enabled: boolean };
  carNumber: { enabled: boolean };
  driverName: { enabled: boolean };
  stint: { enabled: boolean };
  lastTime: { enabled: boolean; timeFormat: TimeFormat };
  speed: { enabled: boolean; unit: 'mph' | 'km/h' | 'auto' };
  gap: { enabled: boolean; decimalPlaces: number };
  displayOrder: string[];
  sessionVisibility: SessionVisibilitySettings;
}

export interface LapTraceConfig {
  /**
   * Settings schema version. Bump and add a migrator under src/types/migrators/
   * when making a breaking change to this shape.
   */
  version: number;
  /**
   * Which saved lap to plot. 'manual' (.ibt import) and 'garage61' are not
   * implemented yet and are shown disabled in settings.
   */
  referenceSource: LapTraceSource;
  /**
   * Metres of track visible behind/ahead of the car. Equal values centre the
   * car; an uneven split shifts it toward whichever side is smaller.
   */
  metersBehind: number;
  metersAhead: number;
  showThrottle: boolean;
  showBrake: boolean;
  showSpeed: boolean;
  showGearLabels: boolean;
  /**
   * Dotted vertical line through the plot at the reference's (and, while
   * driving, your own) interpolated brake application/release points. These
   * carry sub-metre precision the bucket grid cannot.
   */
  showBrakePointMarkers: boolean;
  /**
   * Dotted vertical line through the plot at the reference's interpolated
   * throttle application point.
   */
  showThrottlePointMarkers: boolean;
  /** Bright solid overlay of the lap currently being driven. */
  showGhost: boolean;
  /**
   * Colour the driver's brake trace where ABS engaged, the same way the Input
   * widget marks it on the brake bar.
   */
  showAbs: boolean;
  /**
   * 'overlay' colours the brake line itself where ABS engaged. 'bar' also
   * fills the area under the brake curve down to the axis for that stretch —
   * the same style the Input Trace widget's ABS indicator uses — so it reads
   * as a bar rather than a highlighted line, and mixes colour with a filled
   * reference trace (throttle or brake) it overlaps.
   */
  absStyle?: 'overlay' | 'bar';
  /** Also mark ABS activity as a strip beneath the traces. */
  showAbsBar: boolean;
  /** Opacity of the saved reference lap traces and filled bars. */
  ghostOpacity: number;
  /** Opacity of the live driver input trace. */
  driverOpacity: number;
  /** Fill the reference throttle/brake traces as bars down to the axis instead of plotting a line. */
  referenceFilled: boolean;
  strokeWidth: number;
  /** Color of the vertical line marking the car's current position. */
  carLineColor: string;
  /** User-editable plot colours (reference/ghost traces, fills, ABS, markers, grid). */
  colors: LapTraceColors;
  /**
   * Compact row under the plot summarising the corner just completed against
   * the reference lap. Appears on corner exit and clears on the next corner's
   * entry. Needs the bundled track data for the circuit; silently absent
   * without it.
   */
  showLastCorner: boolean;
  /** Corner time delta in the last-corner row. Negative (green) is faster. */
  showLastCornerTime: boolean;
  /**
   * Metres earlier/later the driver braked into the corner than the
   * reference. Positive (green) means later.
   */
  showLastCornerBrakeDelta: boolean;
  /**
   * Delta between the lowest speed each lap carried through the corner.
   * Positive (green) means the driver carried more.
   */
  showLastCornerApexSpeed: boolean;
  /** Column order for the last-corner history panel. */
  lastCornerDisplayOrder?: LastCornerDisplayColumn[];
  /** Unit for the apex-speed delta. 'auto' follows iRacing's DisplayUnits. */
  lastCornerSpeedUnit: 'mph' | 'km/h' | 'auto';
  /**
   * How a corner is named. 'name' uses the track data's own name and wraps it
   * over two lines when it is long ('Variante Tamburello A'); 'number' uses the
   * turn number instead ('T1A'), which keeps the rows compact. Where the track
   * data does not number its corners they are counted off in order.
   */
  lastCornerLabelStyle: 'name' | 'number';
  /** Text size of the last-corner row in px; its icons and height scale with it. */
  lastCornerFontSize: number;
  /** How much bigger the corner just finished is drawn than the older ones behind it. */
  lastCornerLatestScale: number;
  /**
   * How many recent corners the panel keeps on screen. More than one matters
   * through esses and chicanes, where the next corner starts before there is
   * time to read the last one's result.
   */
  lastCornerCount: number;
  /** Which edge of the graph the last-corner panel sits on. */
  lastCornerPosition: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Beeps 3, 2 and 1 seconds before the reference lap's brake point, and a
   * distinct tone at the point itself. Needs a reference lap carrying recorded
   * brake points; a Garage 61 import may not have them.
   */
  brakeCueAudio: boolean;
  /**
   * Which system playback device the countdown tones use, as a
   * `MediaDeviceInfo.deviceId` from `enumerateDevices()`. The sentinel
   * 'default' follows whatever Windows is currently using, which is what the
   * cues did before this setting existed. A stored id that is no longer
   * present (headset unplugged) falls back to the default device.
   */
  brakeCueOutputDeviceId: string;
  /** Volume of the brake countdown tones, 0..1. */
  brakeCueVolume: number;
  /** Seconds to trigger every brake audio cue before its visual timing, 0..0.6. */
  brakeCueLeadSec: number;
  /**
   * Peak brake pressure a reference application must reach to count as a braking
   * zone, 0.05..0.25. Anything softer is treated as a stabilising brush and gets
   * neither a countdown nor a brake-distance delta. Car-dependent (brake bias,
   * pedal travel, and some cars log force rather than travel), hence a setting.
   */
  brakeCueMinPeak: number;
  /** Per-cue synthesis of the countdown tones (frequency/type/duration/peak). */
  sound: LapTraceSound;
  /** A four-bar countdown strip on the edge of the widget. */
  brakeCueBars: boolean;
  /**
   * Which edge of the widget the countdown strip sits on. 'left'/'right' are
   * a vertical column of 4 discrete bars running the full height of the
   * plot; 'top'/'bottom' are a single continuous bar running the full width.
   */
  brakeCueBarSide: 'left' | 'right' | 'top' | 'bottom';
  /**
   * Which end of the strip the final bar sits at — the one that turns red at
   * the brake point. 'top' drains downwards, 'bottom' drains upwards.
   */
  brakeCueLastBar: 'top' | 'bottom';
  background: { opacity: number };
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export type LastCornerDisplayColumn =
  'corner' | 'cornerTimeDelta' | 'brakePointDelta' | 'apexSpeedDelta';

export type SessionRetention = 'all' | 5 | 10 | 20;

/** Which quantity the lap graph's y axis measures. */
export type LapGraphYAxisMode = 'trace' | 'position' | 'gap';

export interface LapGraphConfig {
  /** Which y axis the graph opens on. */
  yAxisMode: LapGraphYAxisMode;
  /** Laps visible by default; the graph follows the latest lap. */
  lapWindow: number;
  /** Auto-pin the player, the class leader, and the cars around the player. */
  autoPin: boolean;
}

/** The recorder keeps 300 laps per car, so a wider window has nothing to show. */
export const LAP_GRAPH_LAP_WINDOW_BOUNDS = { min: 5, max: 300 } as const;

/** Overlay widgets that can be docked under the Gantry incident feed. */
export const GANTRY_DOCK_WIDGET_TYPES = ['fuel', 'map', 'flatmap'] as const;
export type GantryDockWidgetType = (typeof GANTRY_DOCK_WIDGET_TYPES)[number];

export const GANTRY_DOCK_MAX_PANELS = 3;

export interface GantryDockPanel {
  /** Stable key for React and the remembered collapsed state. */
  id: string;
  type: GantryDockWidgetType;
  /** Fuel only: the linked overlay instance or a Gantry-only instance. */
  widgetId?: string;
}

export interface GantryDockConfig {
  enabled: boolean;
  arrangement: 'row' | 'tabs';
  /** At most GANTRY_DOCK_MAX_PANELS. */
  panels: GantryDockPanel[];
}

export interface GantryConfig {
  /** Display units for speed values. Stored thresholds stay in km/h. */
  speedUnit: 'mph' | 'km/h' | 'auto';
  /** How driver names are written in the standings list. */
  driverNameFormat: NameFormat;
  /**
   * Bumped when a saved threshold's meaning changes. Configs below the current
   * version are reset rather than converted; see migrateGantryThresholds.
   */
  thresholdsVersion: number;
  // Incident detection thresholds
  slowSpeedThreshold: number;
  slowDurationSeconds: number;
  impactDecelKmhPerSec: number;
  impactMinSpeed: number;
  offTrackDurationSeconds: number;
  pitEntryDurationSeconds: number;
  cooldownSeconds: number;
  // Persistence
  sessionRetention: SessionRetention;
  /**
   * iRacing camera group the incident replay buttons switch to, by name.
   * Names differ per track and content, so this is matched against the
   * session's own CameraInfo groups and ignored when it is not present.
   */
  incidentCameraGroup: string;
  // Lap Graph tab
  lapGraph: LapGraphConfig;
  window: GantryWindowConfig;
  /** Panels shown under the incident feed. Sanitise with sanitizeGantryDock. */
  dock: GantryDockConfig;
}

export interface GantryWindowConfig {
  /** Keep the Gantry window above iRacing and other apps. */
  alwaysOnTop: boolean;
}

/** Chase camera far enough back to show what happened around the car. */
export const DEFAULT_INCIDENT_CAMERA_GROUP = 'Far Chase';

export type GantryWidgetSettings = BaseWidgetSettings<GantryConfig>;

/** Series look for the broadcast tower. */
export type BroadcastTheme = 'imsa' | 'wec' | 'f1';

/** How the tower animates from one page to the next. */
export type BroadcastTransition =
  | 'random'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'fade-in'
  | 'flip'
  | 'wipe'
  | 'zoom'
  | 'checker';

/** What the right-hand column of the tower can show. */
export type BroadcastPage = 'names' | 'gaps' | 'gained' | 'pits' | 'tyres';

/**
 * The tower clock: the session clock alone, with the time of day at the
 * track or on this PC, or laps and time together.
 */
export type BroadcastHeaderClock =
  'session' | 'session-track' | 'session-local' | 'laps-time';

/** TV-style leaderboard and focus-car card, meant for OBS capture. */
export interface BroadcastConfig {
  theme: BroadcastTheme;
  /**
   * Series logo above the tower title, as an image data URL. Stored inline so
   * it reaches the OBS page with the rest of the dashboard.
   */
  logo: string;
  background: { opacity: number };
  /** Fades the whole widget, text included, so it covers less of the stream. */
  translucent: { enabled: boolean; opacity: number };
  /** Rows shown per class; the focus car is added below when outside them. */
  driversPerClass: number;
  /** Header text; blank shows the track name. */
  title: string;
  /** Rotate through the chosen pages, or keep one page up. */
  pageMode: 'rotate' | 'static';
  /** Pages in the rotation; one with nothing to show yet is skipped. */
  pages: Record<BroadcastPage, boolean>;
  /** The page a static tower shows; its intervals cover every class. */
  staticPage: BroadcastPage;
  /** How long each tower page (names, gaps per class, gained, pits, tyres) stays up. */
  pageSeconds: number;
  headerClock: BroadcastHeaderClock;
  /** Page change animation; random never repeats the last one. */
  pageTransition: BroadcastTransition;
  /** Lower-third card for the car the camera is on. */
  showFocusCard: boolean;
  /** Starting grid before the green flag (the podium is its own widget). */
  phaseScreens: boolean;
  driverNameFormat: NameFormat;
  sessionVisibility: SessionVisibilitySettings;
}

export type BroadcastWidgetSettings = BaseWidgetSettings<BroadcastConfig>;

/**
 * Weather card that pops up on change, and every `intervalMinutes`
 * (0 = only on change), for `showSeconds`.
 */
export interface BroadcastWeatherConfig {
  background: { opacity: number };
  intervalMinutes: number;
  showSeconds: number;
  sessionVisibility: SessionVisibilitySettings;
}

export type BroadcastWeatherWidgetSettings =
  BaseWidgetSettings<BroadcastWeatherConfig>;

/** Podium places drawn as metal steps or as trophies. */
export type BroadcastPodiumStyle = 'steps' | 'trophy';

/** Podium of each class after the checkered flag of a race. */
export interface BroadcastPodiumConfig {
  background: { opacity: number };
  style: BroadcastPodiumStyle;
}

export type BroadcastPodiumWidgetSettings =
  BaseWidgetSettings<BroadcastPodiumConfig>;

/** Scrolling bottom-of-screen ticker that cycles standings views. */
export interface BroadcastTickerConfig {
  background: { opacity: number };
  /** Fades the whole widget, text included, so it covers less of the stream. */
  translucent: { enabled: boolean; opacity: number };
  /** Scroll speed: how long each car stays in the loop. */
  secondsPerEntry: number;
  sessionVisibility: SessionVisibilitySettings;
}

export type BroadcastTickerWidgetSettings =
  BaseWidgetSettings<BroadcastTickerConfig>;

/** Race control popups: incidents and flags, with the driver involved. */
export interface BroadcastEventsConfig {
  background: { opacity: number };
  /** How long each event stays up; queued events follow one by one. */
  showSeconds: number;
  kinds: {
    crash: boolean;
    offTrack: boolean;
    slowdown: boolean;
    blackFlag: boolean;
    yellow: boolean;
    caution: boolean;
    fastestLap: boolean;
    pitStop: boolean;
    meatball: boolean;
    disqualified: boolean;
    finalLap: boolean;
    checkered: boolean;
  };
  sessionVisibility: SessionVisibilitySettings;
}

export type BroadcastEventsWidgetSettings =
  BaseWidgetSettings<BroadcastEventsConfig>;

// ===========================
// Widget config map + typed widget
// ===========================

export interface InformationBarConfig extends SessionBarConfig {
  background: { opacity: number };
  foreground: { opacity: number };
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

export interface WidgetConfigMap {
  standings: StandingsConfig;
  relative: RelativeConfig;
  weather: WeatherConfig;
  wind: WindConfig;
  map: TrackMapConfig;
  flatmap: FlatTrackMapConfig;
  input: InputConfig;
  tachometer: TachometerConfig;
  shiftlight: ShiftLightConfig;
  fuel: FuelConfig;
  blindspotmonitor: BlindSpotMonitorConfig;
  radar: RadarConfig;
  garagecover: GarageCoverConfig;
  rejoin: RejoinIndicatorConfig;
  flag: FlagConfig;
  telemetryinspector: TelemetryInspectorConfig;
  fastercarsfrombehind: FasterCarsFromBehindConfig;
  pitlanehelper: PitlaneHelperConfig;
  twitchchat: TwitchChatConfig;
  laptimelog: LapTimeLogConfig;
  infobar: InformationBarConfig;
  slowcarahead: SlowCarAheadConfig;
  sectordelta: SectorDeltaConfig;
  deltaspeed: DeltaSpeedConfig;
  carsystems: CarSystemsConfig;
  heartrate: HeartRateConfig;
  cornername: CornerNameOverlayConfig;
  battle: BattleConfig;
  laptrace: LapTraceConfig;
  gantry: GantryConfig;
  broadcast: BroadcastConfig;
  broadcastticker: BroadcastTickerConfig;
  broadcastevents: BroadcastEventsConfig;
  broadcastweather: BroadcastWeatherConfig;
  broadcastpodium: BroadcastPodiumConfig;
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
  | 'styling'
  | 'track'
  | 'drivers'
  | 'layout'
  | 'header'
  | 'footer'
  | 'history'
  | 'telemetry'
  | 'dashboard'
  | 'chromium'
  | 'incidents'
  | 'trace'
  | 'corner'
  | 'braking'
  | 'help'
  | 'dock';

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
export type WindWidgetSettings = BaseWidgetSettings<WindConfig>;
export type TrackMapWidgetSettings = BaseWidgetSettings<TrackMapConfig>;
export type FlatTrackMapWidgetSettings = BaseWidgetSettings<FlatTrackMapConfig>;
export type SteerWidgetSettings = BaseWidgetSettings<SteerConfig>;
export type InputWidgetSettings = BaseWidgetSettings<InputConfig>;
export type TachometerWidgetSettings = BaseWidgetSettings<TachometerConfig>;
export type ShiftLightWidgetSettings = BaseWidgetSettings<ShiftLightConfig>;
export type FuelWidgetSettings = BaseWidgetSettings<FuelConfig>;
export type BlindSpotMonitorWidgetSettings =
  BaseWidgetSettings<BlindSpotMonitorConfig>;
export type RadarWidgetSettings = BaseWidgetSettings<RadarConfig>;
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
export type LapTimeLogWidgetSettings = BaseWidgetSettings<LapTimeLogConfig>;
export type InformationBarWidgetSettings =
  BaseWidgetSettings<InformationBarConfig>;
export type SlowCarAheadWidgetSettings = BaseWidgetSettings<SlowCarAheadConfig>;
export type SectorDeltaWidgetSettings = BaseWidgetSettings<SectorDeltaConfig>;
export type DeltaSpeedWidgetSettings = BaseWidgetSettings<DeltaSpeedConfig>;
export type CarSystemsWidgetSettings = BaseWidgetSettings<CarSystemsConfig>;
export type HeartRateWidgetSettings = BaseWidgetSettings<HeartRateConfig>;
export type CornerNameWidgetSettings =
  BaseWidgetSettings<CornerNameOverlayConfig>;
export type BattleWidgetSettings = BaseWidgetSettings<BattleConfig>;
export type LapTraceWidgetSettings = BaseWidgetSettings<LapTraceConfig>;
