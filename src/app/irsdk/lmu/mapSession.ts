import type {
  Session,
  SessionResults,
  Driver,
  LmuTrackMap,
} from '@irdashies/types';

type Raw = import('../native/lmu').LmuRawSession;

// LMU shared memory has no car numbers or series metadata. Drivers are
// presented by their slot index; replace CarNumber sourcing if a REST/league
// datasource is added later.
const DEFAULT_CAR_NUMBER = (carIdx: number) => String(carIdx + 1);
const LMU_TRACK_ID_OFFSET = 1_000_000;
const DEFAULT_MAX_RPM = 8500;

export function deriveLmuShiftLightRpm(engineMaxRpm?: number) {
  const maxRpm =
    engineMaxRpm !== undefined &&
    Number.isFinite(engineMaxRpm) &&
    engineMaxRpm > 0
      ? engineMaxRpm
      : DEFAULT_MAX_RPM;
  return {
    first: Math.round(maxRpm * 0.91),
    shift: Math.round(maxRpm * 0.95),
    last: Math.round(maxRpm * 0.97),
    blink: Math.round(maxRpm * 0.97),
  };
}

export function resolveLmuTrackId(trackName: string): number {
  let hash = 2166136261;
  for (const character of trackName.trim().toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return LMU_TRACK_ID_OFFSET + (hash >>> 0);
}

const LMU_MANUFACTURER_CAR_IDS: readonly [RegExp, number][] = [
  [/\baston martin\b/i, 10001],
  [/\baudi\b/i, 10002],
  [/\bbmw\b/i, 10003],
  [/\bcadillac\b/i, 10004],
  [/\b(?:chevrolet|corvette)\b/i, 10005],
  [/\bferrari\b/i, 10006],
  [/\bford\b/i, 10007],
  [/\blamborghini\b/i, 10008],
  // LMP3 chassis maker. Must precede engine-supplier brands so a
  // "Ligier JS P320 Nissan" style model never resolves to the engine badge.
  [/\bligier\b/i, 10013],
  [/\bmclaren\b/i, 10009],
  [/\bmercedes(?:-amg)?\b/i, 10010],
  [/\bporsche\b/i, 10011],
  [/\btoyota\b/i, 10012],
];

export function resolveLmuCarId(vehicleModel: string): number {
  return (
    LMU_MANUFACTURER_CAR_IDS.find(([pattern]) =>
      pattern.test(vehicleModel)
    )?.[1] ?? 0
  );
}

const LMU_CONTROL_AI = 1;

export function isLmuAiControlled(control?: number): boolean | undefined {
  return control === undefined ? undefined : control === LMU_CONTROL_AI;
}

function sessionType(session: number): string {
  if (session >= 10) return 'Race';
  if (session >= 5 && session <= 8) return 'Open Qualify';
  if (session >= 1) return 'Practice';
  return 'Offline Testing';
}

/**
 * Builds the iRacing-shaped Session object from an LMU session snapshot.
 * Fields with no LMU equivalent keep safe defaults so widgets degrade
 * gracefully instead of crashing on missing data.
 */
export function mapLmuSession(
  raw: Raw,
  trackMap?: LmuTrackMap | null,
  pitSpeedLimitMs?: number
): Session {
  const trackLengthM = raw.lapDist;
  const shiftLights = deriveLmuShiftLightRpm(raw.engineMaxRPM);

  const drivers: Driver[] = raw.drivers.map((d) => ({
    CarIdx: d.id,
    UserName: d.name,
    AbbrevName: null,
    Initials: null,
    UserID: 0,
    TeamID: 0,
    TeamName: d.name,
    CarNumber: DEFAULT_CAR_NUMBER(d.id),
    CarNumberRaw: d.id + 1,
    CarPath: d.vehFilename,
    CarClassID: d.classId,
    CarID: resolveLmuCarId(d.vehicleModel ?? d.vehicleName),
    CarIsPaceCar: 0,
    CarIsAI: isLmuAiControlled(d.control) ? 1 : 0,
    CarIsAIControlled: isLmuAiControlled(d.control),
    CarIsElectric: 0,
    CarScreenName: d.vehicleName,
    CarScreenNameShort: d.vehicleName.split(' ')[0] ?? '',
    CarCfg: 0,
    CarCfgName: null,
    CarCfgCustomPaintExt: null,
    CarClassShortName: d.className,
    CarClassRelSpeed: 0,
    CarClassLicenseLevel: 0,
    CarClassMaxFuelPct: '',
    CarClassWeightPenalty: '',
    CarClassPowerAdjust: '',
    CarClassDryTireSetLimit: '',
    CarClassColor: 0,
    CarClassEstLapTime: d.estimatedLapTime,
    IRating: 0,
    LicLevel: 0,
    LicSubLevel: 0,
    LicString: 'LMU',
    LicColor: 0,
    IsSpectator: 0,
    CarDesignStr: '',
    HelmetDesignStr: '',
    SuitDesignStr: '',
    BodyType: 0,
    FaceType: 0,
    HelmetType: 0,
    CarNumberDesignStr: '',
    CarSponsor_1: 0,
    CarSponsor_2: 0,
    ClubName: '',
    ClubID: 0,
    FlairName: '',
    FlairID: 0,
    DivisionName: '',
    DivisionID: 0,
    CurDriverIncidentCount: 0,
    TeamIncidentCount: 0,
  }));

  const playerDriver = raw.drivers.find((d) => d.isPlayer);
  const playerIdx = playerDriver?.id ?? -1;
  const currentSessionType = sessionType(raw.session);

  // Qualifying grid: qualification is LMU's quali time; class ranks computed
  // within each class so the standings fall back to a proper grid.
  const qualiSorted = [...raw.drivers]
    .filter((d) => d.qualification > 0)
    .sort((a, b) => a.qualification - b.qualification);
  const classRank = new Map<number, number>();
  const qualiResults: SessionResults[] = qualiSorted.map((d, idx) => {
    const classKey = d.classId;
    const classPos = (classRank.get(classKey) ?? 0) + 1;
    classRank.set(classKey, classPos);
    return {
      Position: idx + 1,
      ClassPosition: classPos,
      CarIdx: d.id,
      Lap: 0,
      Time: 0,
      FastestLap: 0,
      FastestTime: d.bestLapTime,
      LastTime: d.lastLapTime,
      LapsLed: 0,
      LapsComplete: d.totalLaps,
      JokerLapsComplete: 0,
      LapsDriven: d.totalLaps,
      Incidents: 0,
      ReasonOutId: 0,
      ReasonOutStr: '',
    };
  });

  return {
    WeekendInfo: {
      TrackName: raw.trackName,
      TrackID: resolveLmuTrackId(raw.trackName),
      TrackLength: `${trackLengthM} m`,
      TrackLengthOfficial: `${trackLengthM} m`,
      TrackDisplayName: raw.trackName,
      TrackDisplayShortName: raw.trackName,
      TrackConfigName: null,
      TrackCity: '',
      TrackState: 'green',
      TrackCountry: '',
      TrackAltitude: '',
      TrackLatitude: '',
      TrackLongitude: '',
      TrackNorthOffset: '',
      TrackNumTurns: 0,
      TrackPitSpeedLimit:
        pitSpeedLimitMs !== undefined
          ? `${(pitSpeedLimitMs * 3.6).toFixed(2)} kph`
          : '',
      TrackPaceSpeed: '0',
      TrackNumPitStalls: 0,
      TrackType: '',
      TrackDirection: '',
      TrackWeatherType: 'Realistic',
      TrackSkies: raw.cloudCoverage > 50 ? 'Cloudy' : 'Clear',
      TrackSurfaceTemp: '',
      TrackAirTemp: '',
      TrackAirPressure: '',
      TrackAirDensity: '',
      TrackWindVel: String(Math.hypot(raw.wind[0] ?? 0, raw.wind[2] ?? 0)),
      TrackWindDir: '',
      TrackRelativeHumidity: '',
      TrackFogLevel: '',
      TrackPrecipitation: raw.raining > 0 ? 'Rain' : 'Dry',
      TrackCleanup: 0,
      TrackDynamicTrack: 0,
      TrackVersion: `0.0.${raw.gameVersion}`,
      SeriesID: 0,
      SeasonID: 0,
      SessionID: raw.session,
      SubSessionID: raw.session,
      LeagueID: 0,
      Official: 0,
      RaceWeek: 0,
      EventType: currentSessionType,
      Category: 'Sports Car',
      SimMode: 'Le Mans Ultimate',
      TeamRacing: 0,
      MinDrivers: 0,
      MaxDrivers: raw.maxPlayers,
      DCRuleSet: '',
      QualifierMustStartRace: 0,
      NumCarClasses: new Set(raw.drivers.map((d) => d.classId)).size,
      NumCarTypes: new Set(
        raw.drivers.map((d) => d.vehicleModel ?? d.vehicleName)
      ).size,
      HeatRacing: 0,
      BuildType: 'release',
      BuildTarget: 'linux',
      BuildVersion: String(raw.gameVersion),
      RaceFarm: 'lm',
      WeekendOptions: {
        NumStarters: 0,
        StartingGrid: '',
        QualifyScoring: '',
        CourseCautions: '',
        StandingStart: 0,
        ShortParadeLap: 0,
        Restarts: '',
        WeatherType: '',
        Skies: '',
        WindDirection: '',
        WindSpeed: '',
        WeatherTemp: '',
        RelativeHumidity: '',
        FogLevel: '',
        TimeOfDay: '',
        Date: '',
        EarthRotationSpeedupFactor: 0,
        Unofficial: 1,
        CommercialMode: '',
        NightMode: '',
        IsFixedSetup: raw.isFixedSetup ? 1 : 0,
        StrictLapsChecking: '',
        HasOpenRegistration: 0,
        HardcoreLevel: 0,
        NumJokerLaps: 0,
        IncidentLimit: '',
        IncidentWarningInitialLimit: 0,
        IncidentWarningSubsequentLimit: 0,
        FastRepairsLimit: 0,
        GreenWhiteCheckeredLimit: 0,
      },
      TelemetryOptions: {
        TelemetryDiskFile: '',
      },
    },
    SessionInfo: {
      Sessions: [
        {
          SessionNum: raw.session,
          SessionLaps: `${raw.maxLaps}`,
          SessionTime: '',
          SessionNumLapsToAvg: 0,
          SessionType: currentSessionType,
          SessionTrackRubberState: '',
          SessionName: currentSessionType,
          SessionSubType: null,
          SessionSkipped: 0,
          SessionRunGroupsUsed: 0,
          ResultsPositions: null,
          ResultsFastestLap: [],
          QualifyPositions: qualiResults.map((q) => ({
            Position: q.Position,
            ClassPosition: q.ClassPosition,
            CarIdx: q.CarIdx,
            FastestLap: q.FastestLap,
            FastestTime: q.FastestTime,
          })),
          ResultsAverageLapTime: 0,
          ResultsNumCautionFlags: 0,
          ResultsNumCautionLaps: 0,
          ResultsNumLeadChanges: 0,
          ResultsLapsComplete: 0,
          ResultsOfficial: 0,
        },
      ],
    },
    CameraInfo: { Groups: [] },
    RadioInfo: { SelectedRadioNum: 0, Radios: [] },
    DriverInfo: {
      DriverCarIdx: playerIdx,
      DriverUserID: 0,
      PaceCarIdx: -1,
      DriverHeadPosX: 0,
      DriverHeadPosY: 0,
      DriverHeadPosZ: 0,
      DriverCarIsElectric: 0,
      DriverCarIdleRPM: 800,
      DriverCarRedLine:
        raw.engineMaxRPM !== undefined &&
        Number.isFinite(raw.engineMaxRPM) &&
        raw.engineMaxRPM > 0
          ? raw.engineMaxRPM
          : DEFAULT_MAX_RPM,
      DriverCarEngCylinderCount: 0,
      DriverCarFuelKgPerLtr: 0,
      DriverCarFuelMaxLtr: raw.fuelCapacity ?? 0,
      DriverCarMaxFuelPct: 1,
      DriverCarGearNumForward: raw.maxGears ?? 6,
      DriverCarGearNeutral: 0,
      DriverCarGearReverse: -1,
      DriverCarSLFirstRPM: shiftLights.first,
      DriverCarSLShiftRPM: shiftLights.shift,
      DriverCarSLLastRPM: shiftLights.last,
      DriverCarSLBlinkRPM: shiftLights.blink,
      DriverCarVersion: '',
      DriverPitTrkPct: 0,
      DriverCarEstLapTime: playerDriver?.estimatedLapTime ?? 0,
      DriverSetupName: '',
      DriverSetupIsModified: 0,
      DriverSetupLoadTypeName: '',
      DriverSetupPassedTech: 0,
      DriverIncidentCount: 0,
      DriverBrakeCurvingFactor: 0,
      DriverTires: [
        {
          TireIndex: 0,
          TireCompoundType: raw.frontTireCompoundName ?? '',
        },
      ],
      Drivers: drivers,
    },
    // ponytail: nominal thirds only label the direct LMU timing; replace when LMU exposes boundary distances.
    SplitTimeInfo: {
      Sectors: [
        { SectorNum: 0, SectorStartPct: 0 },
        { SectorNum: 1, SectorStartPct: 1 / 3 },
        { SectorNum: 2, SectorStartPct: 2 / 3 },
      ],
    },
    CarSetup: { UpdateCount: 0 },
    QualifyResultsInfo: { Results: qualiResults },
    ...(trackMap ? { LmuTrackMap: trackMap } : {}),
  };
}
