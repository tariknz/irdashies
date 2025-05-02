// @todo: This should be auto generated XD

export interface WeekendOptions {
  NumStarters: number;
  StartingGrid: string;
  QualifyScoring: string;
  CourseCautions: string;
  StandingStart: number; // maybe bool?
  ShortParadeLap: number; // maybe bool?
  Restarts: string;
  WeatherType: string; // is there an enum for this?
  Skies: string; // is there an enum for this?
  WindDirection: string; // is there an enum for this?
  WindSpeed: string;
  WeatherTemp: string;
  RelativeHumidity: string;
  FogLevel: string;
  TimeOfDay: string;
  Date: string;
  EarthRotationSpeedupFactor: number;
  Unofficial: number; // bool?
  CommercialMode: string; // is there an enum for this?
  NightMode: string;
  IsFixedSetup: number; // bool?
  StrictLapsChecking: string;
  HasOpenRegistration: number; // bool?
  HardcoreLevel: number;
  NumJokerLaps: number;
  IncidentLimit: string;
  FastRepairsLimit: number;
  GreenWhiteCheckeredLimit: number;
}

export interface TelemetryOptions {
  TelemetryDiskFile: string;
}

export interface WeekendInfo {
  TrackName: string;
  TrackID: number;
  TrackLength: string;
  TrackDisplayName: string;
  TrackDisplayShortName: string;
  TrackConfigName: string | null;
  TrackCity: string;
  TrackCountry: string;
  TrackAltitude: string;
  TrackLatitude: string;
  TrackLongitude: string;
  TrackNorthOffset: string;
  TrackNumTurns: number;
  TrackPitSpeedLimit: string;
  TrackType: string;
  TrackDirection: string;
  TrackWeatherType: string;
  TrackSkies: string;
  TrackSurfaceTemp: string;
  TrackAirTemp: string;
  TrackAirPressure: string;
  TrackWindVel: string;
  TrackWindDir: string;
  TrackRelativeHumidity: string;
  TrackFogLevel: string;
  TrackCleanup: number;
  TrackDynamicTrack: number;
  TrackVersion: string;
  SeriesID: number;
  SeasonID: number;
  SessionID: number;
  SubSessionID: number;
  LeagueID: number;
  Official: number; // bool?
  RaceWeek: number;
  EventType: string; // enum?
  Category: string; // enum?
  SimMode: string;
  TeamRacing: number;
  MinDrivers: number;
  MaxDrivers: number;
  DCRuleSet: string;
  QualifierMustStartRace: number; // bool?
  NumCarClasses: number;
  NumCarTypes: number;
  HeatRacing: number;
  BuildType: string;
  BuildTarget: string;
  BuildVersion: string;
  WeekendOptions: WeekendOptions;
  TelemetryOptions: TelemetryOptions;
}
