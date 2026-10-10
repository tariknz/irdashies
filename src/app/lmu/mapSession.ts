import type {
  Session,
  SessionResults,
  Driver,
  LmuTrackMap,
} from '@irdashies/types';

import {
  classColourForRank,
  LMU_CLASS_COLOURS,
  LMU_MANUFACTURERS,
} from '@irdashies/types';
import { fnv1a32 } from './hash';
import { compareLmuOrder, lmuOrderingKey } from './classPosition';
import type { LmuRestSession } from '@irdashies/types';

/**
 * LMU's pit and rolling-start speed limit, km/h.
 *
 * Fixed at 60 across every circuit. Unlike titles where the limit varies by
 * track there is nothing to detect and nothing to look up, so this replaces an
 * estimate measured off the car's own limited speed -- which had no better
 * source available, but could only ever converge on the number written here,
 * and read wrongly until it did.
 */
export const LMU_PIT_SPEED_LIMIT_KPH = 60;
import { lapTimeOrAbsent } from './sentinels';

type Raw = import('./native').LmuRawSession;

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
  return LMU_TRACK_ID_OFFSET + fnv1a32(trackName.trim().toLowerCase());
}

export function resolveLmuCarId(vehicleModel: string): number {
  return (
    LMU_MANUFACTURERS.find(({ pattern }) => pattern.test(vehicleModel))?.id ?? 0
  );
}

const LMU_CONTROL_AI = 1;

export function isLmuAiControlled(control?: number): boolean | undefined {
  return control === undefined ? undefined : control === LMU_CONTROL_AI;
}

/**
 * LMU's car classes, fastest first.
 *
 * Static knowledge, because the shared memory carries no class ordering. The
 * per-car class id the addon hands out is first-encounter order -- whichever
 * class appears first in the scoring array gets 0 -- so it says nothing about
 * speed, and mEstimatedLapTime is a live estimate of the lap being driven, so
 * it moves with traffic and fuel and would reshuffle the colours mid-session.
 *
 * Rank drives both the class colour and the relative speed the faster-car
 * warning compares, so the two can never disagree about which class is quicker.
 */
const LMU_CLASSES_FASTEST_FIRST = [
  'Hypercar',
  'LMP2',
  'LMP3',
  'LMGT3',
  'LMGTE',
] as const;

/** Upper-cased and stripped of punctuation, so "LM GT3" and "LMGT3" match. */
const normaliseClassName = (name: string) =>
  name.toUpperCase().replace(/[^A-Z0-9]/g, '');

type LmuClass = (typeof LMU_CLASSES_FASTEST_FIRST)[number];

/**
 * Normalised spellings that each canonical class answers to.
 *
 * Also accepts the name without its "LM" prefix: the same class is written
 * both ways ("GT3" and "LMGT3"), and this repo's own fixtures use the short
 * form. Only the prefix is optional -- nothing here guesses a class.
 */
const LMU_CLASS_KEYS: readonly (readonly [string, LmuClass])[] =
  LMU_CLASSES_FASTEST_FIRST.flatMap((name) => {
    const key = normaliseClassName(name);
    const short = key.startsWith('LM') ? key.slice(2) : undefined;
    return short
      ? ([
          [key, name],
          [short, name],
        ] as const)
      : ([[key, name]] as const);
  });

/**
 * The canonical class a name refers to, or undefined when it is not one this
 * build knows.
 *
 * LMU's spelling differs from the canonical name in both directions, so this
 * matches on a prefix either way round:
 *
 * - Longer than the class. It qualifies names with the championship they
 *   belong to -- "LMP2_ELMS", not "LMP2". The longest matching key wins, so a
 *   suffixed name cannot be captured by a shorter class whose name happens to
 *   start the same way.
 * - Shorter than the class. It abbreviates -- "Hyper", not "Hypercar". Here
 *   the name has to pick out exactly one class to be usable: "LMGT" prefixes
 *   both LMGT3 and LMGTE, and guessing between them would be worse than
 *   admitting the name is not one this build knows.
 *
 * Neither direction is cosmetic. An unmatched class takes no rank and no
 * colour, which is why LMP2 cars showed no class colour under their number
 * while LMP3 -- reported unqualified -- did, and why Hypercar showed none
 * either.
 */
const lmuCanonicalClass = (
  className: string | undefined
): LmuClass | undefined => {
  if (className === undefined) return undefined;
  const key = normaliseClassName(className);
  if (key.length === 0) return undefined;

  // A name at least as long as the class it names: take the longest match.
  let match: LmuClass | undefined;
  let matchedLength = 0;
  for (const [candidate, name] of LMU_CLASS_KEYS) {
    if (key.startsWith(candidate) && candidate.length > matchedLength) {
      match = name;
      matchedLength = candidate.length;
    }
  }
  if (match !== undefined) return match;

  // An abbreviation, accepted only where it names one class unambiguously.
  const abbreviated = new Set(
    LMU_CLASS_KEYS.filter(([candidate]) => candidate.startsWith(key)).map(
      ([, name]) => name
    )
  );
  return abbreviated.size === 1 ? [...abbreviated][0] : undefined;
};

/** Speed rank of a class, or -1 when it is not one this build knows. */
const lmuClassRank = (className: string | undefined): number => {
  const canonical = lmuCanonicalClass(className);
  return canonical === undefined
    ? -1
    : LMU_CLASSES_FASTEST_FIRST.indexOf(canonical);
};

/**
 * Whether this LMU session id is a race.
 *
 * Only a race can have a lap limit; practice and qualifying are always timed.
 * Exported so the telemetry mapper decides that the same way this does, from
 * one copy of the thresholds.
 */
export const isLmuRaceSession = (session: number): boolean => session >= 10;

function sessionType(session: number): string {
  if (isLmuRaceSession(session)) return 'Race';
  if (session >= 5 && session <= 8) return 'Open Qualify';
  if (session >= 1) return 'Practice';
  return 'Offline Testing';
}

/**
 * Builds the iRacing-shaped Session object from an LMU session snapshot.
 * Fields with no LMU equivalent keep safe defaults so widgets degrade
 * gracefully instead of crashing on missing data.
 */

/** A usable positive quantity, or undefined. */
const positive = (value: number | undefined): number | undefined =>
  value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;

/**
 * The player's fuel tank, in litres.
 *
 * One rule for every class, in order of how directly each source states the
 * tank rather than infers it:
 *
 * 1. `maxFuel`, from the pit screen's own fuelInfo. It says the tank outright.
 * 2. `fuelLevelMax`, the top step of the garage's fuel-ratio slider. The ratio
 *    is litres per percent of virtual energy, so at its top step a full energy
 *    load fills the tank exactly -- which makes the bound the tank in litres.
 * 3. `mFuelCapacity` from shared memory, when REST is not answering at all.
 *
 * This used to be a per-class table, with Hypercar and LMGT3 taking
 * `fuelRatio * 100`. That was wrong, and wrong in a way that looked verified:
 * fuelRatio is the slider's *current position*, which the driver sets, not a
 * property of the car. It equals the tank only when the slider happens to sit
 * at maximum, which it did in the session the rule was drawn from. A GT3
 * capture reads a 1.03 ratio -- 103 L -- against a tank that maxFuel,
 * fuelLevelMax and mFuelCapacity all put at 120 L.
 *
 * fuelRatio is still published. It is the conversion between the two budgets
 * an energy-limited car runs on, which is a real and useful thing; it is just
 * not a tank size.
 *
 * Returning 0 tells the fuel calculator to estimate a tank rather than
 * believe this, which is the right answer when nothing here is available.
 */
function resolveLmuFuelCapacityLtr(
  raw: Raw,
  rest: LmuRestSession | undefined
): number {
  return (
    positive(rest?.maxFuel) ??
    positive(rest?.fuelLevelMax) ??
    positive(raw.fuelCapacity) ??
    0
  );
}

/**
 * The running order, as the standings widget consumes it.
 *
 * It builds its rows from ResultsPositions, not from the per-car telemetry
 * channels, so leaving this null left every driver falling through to
 * createDriverStandings' "not yet in results" tail -- which orders by car
 * number and never changes. That was the standings sitting in car-number order
 * for a whole practice session.
 *
 * Non-race sessions list only drivers who have set a time, which is what
 * iRacing does and what the consumer already expects: a car yet to run belongs
 * in that car-number tail rather than being ranked above someone who has.
 *
 * Ordering comes from lmuOrderingKey, shared with the telemetry channels, so
 * the standings and the relative cannot disagree about who is ahead.
 */
function buildLmuResults(raw: Raw, isRace: boolean): SessionResults[] {
  const contenders = raw.drivers.filter(
    (d) => isRace || (d.bestLapTime ?? 0) > 0
  );

  const ordered = [...contenders].sort((a, b) =>
    compareLmuOrder(
      lmuOrderingKey(isRace, a.place, a.bestLapTime),
      lmuOrderingKey(isRace, b.place, b.bestLapTime),
      a.id,
      b.id
    )
  );

  const classRank = new Map<number, number>();
  return ordered.map((d, idx) => {
    const rank = (classRank.get(d.classId) ?? 0) + 1;
    classRank.set(d.classId, rank);
    return {
      Position: idx + 1,
      // Zero-based; the standings add one. See the note on the qualifying grid.
      ClassPosition: rank - 1,
      CarIdx: d.id,
      Lap: d.totalLaps,
      Time: 0,
      FastestLap: 0,
      FastestTime: lapTimeOrAbsent(d.bestLapTime),
      LastTime: lapTimeOrAbsent(d.lastLapTime),
      LapsLed: 0,
      LapsComplete: d.totalLaps,
      JokerLapsComplete: 0,
      LapsDriven: d.totalLaps,
      Incidents: 0,
      ReasonOutId: 0,
      ReasonOutStr: '',
    };
  });
}

export function mapLmuSession(
  raw: Raw,
  trackMap?: LmuTrackMap | null,
  /**
   * Session values from LMU's local REST API. Omitted, the LmuRest key is
   * absent rather than present and empty, so a consumer can tell "not polled"
   * from "polled and found nothing".
   */
  rest?: LmuRestSession
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
    // The canonical class, so the standings group by "LMP2" rather than the
    // championship-qualified "LMP2_ELMS" the sim reports. An unrecognised
    // class keeps whatever LMU called it -- better a name this build does not
    // know than no name at all.
    CarClassShortName: lmuCanonicalClass(d.className) ?? d.className,
    // Higher is faster: the faster-car warning compares these directly, and
    // with every class at 0 it could never fire. Derived from the same rank
    // as the colour, so the two agree by construction.
    CarClassRelSpeed:
      lmuClassRank(d.className) >= 0
        ? LMU_CLASSES_FASTEST_FIRST.length - lmuClassRank(d.className)
        : 0,
    CarClassLicenseLevel: 0,
    CarClassMaxFuelPct: '',
    CarClassWeightPenalty: '',
    CarClassPowerAdjust: '',
    CarClassDryTireSetLimit: '',
    // LMU reports no class colour, so it takes the series' own livery for its
    // class. An unknown class falls back to the rank-based palette, and failing
    // that to no colour and the renderer's neutral default, rather than
    // borrowing another class's.
    CarClassColor:
      LMU_CLASS_COLOURS[lmuCanonicalClass(d.className) ?? ''] ??
      classColourForRank(lmuClassRank(d.className)),
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
      // Zero-based, which is the contract iRacing sets: its own results carry
      // ClassPosition [0, 1, 0, ...] alongside Position [1, 2, 3, ...], and
      // the standings add one when they read it. Publishing a 1-based value
      // here had that increment applied to a number that already counted
      // from one, so every class began at 2.
      ClassPosition: classPos - 1,
      CarIdx: d.id,
      Lap: 0,
      Time: 0,
      FastestLap: 0,
      // createStandings prefers the telemetry frame and falls back to these
      // whenever it has no time there, so an unnormalised zero here is what
      // the standings end up rendering as "0:00.000".
      FastestTime: lapTimeOrAbsent(d.bestLapTime),
      LastTime: lapTimeOrAbsent(d.lastLapTime),
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
      TrackPitSpeedLimit: `${LMU_PIT_SPEED_LIMIT_KPH.toFixed(2)} kph`,
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
          ResultsPositions: buildLmuResults(raw, isLmuRaceSession(raw.session)),
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
      // Placeholder, not a measurement. LMU's shared memory reports no fuel
      // density, and nothing in the app reads this today -- but 0 kg/L is
      // physically false, so anything that later converts kg to litres with
      // it would silently produce zero or divide by it. Give it a real value
      // only once a source for one exists.
      DriverCarFuelKgPerLtr: 0,
      // 0 when neither source reports a capacity. The fuel calculator rejects
      // a non-positive tank size and falls back to estimating one, so this
      // degrades rather than lying -- see calculateRealTankCapacity.
      DriverCarFuelMaxLtr: resolveLmuFuelCapacityLtr(raw, rest),
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
    // Only when something was actually read. An empty object would tell a
    // consumer the API answered and reported nothing, which is a different
    // thing from never having been polled.
    ...(rest && Object.keys(rest).length > 0 ? { LmuRest: rest } : {}),
  };
}
