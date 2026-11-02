import type { LmuDriverRating } from '../../../types/lmu';

export interface Driver {
  CarIdx: number;
  UserName: string;
  AbbrevName: string | null;
  Initials: string | null;
  UserID: number;
  TeamID: number;
  TeamName: string;
  CarNumber: string;
  CarNumberRaw: number;
  CarPath: string;
  CarClassID: number;
  CarID: number;
  CarIsPaceCar: number;
  CarIsAI: number;
  /** Set only by sims that report AI control per driver; iRacing leaves it unset. */
  CarIsAIControlled?: boolean;
  CarIsElectric: number;
  CarScreenName: string;
  CarScreenNameShort: string;
  CarCfg: number;
  CarCfgName: string | null;
  CarCfgCustomPaintExt: string | null;
  CarClassShortName: string;
  CarClassRelSpeed: number;
  CarClassLicenseLevel: number;
  CarClassMaxFuelPct: string;
  CarClassWeightPenalty: string;
  CarClassPowerAdjust: string;
  CarClassDryTireSetLimit: string;
  CarClassColor: number;
  CarClassEstLapTime: number;
  IRating: number;
  LicLevel: number;
  LicSubLevel: number;
  LicString: string;
  LicColor: number;
  IsSpectator: number;
  CarDesignStr: string;
  HelmetDesignStr: string;
  SuitDesignStr: string;
  BodyType: number;
  FaceType: number;
  HelmetType: number;
  CarNumberDesignStr: string;
  CarSponsor_1: number;
  CarSponsor_2: number;
  ClubName: string;
  ClubID: number;
  FlairName: string;
  FlairID: number;
  DivisionName: string;
  DivisionID: number;
  CurDriverIncidentCount: number;
  TeamIncidentCount: number;
  /**
   * Le Mans Ultimate rank, badge and country.
   *
   * Set only by sims that report it -- iRacing leaves it unset, the same way
   * it leaves CarIsAIControlled unset. LMU keeps no iRating or licence, so
   * none of this can be folded into IRating/LicString without inventing
   * numbers; renderers branch on its presence instead.
   */
  LmuRating?: LmuDriverRating;
}

export interface Tire {
  TireIndex: number;
  TireCompoundType: string;
}

export interface DriverInfo {
  DriverCarIdx: number;
  DriverUserID: number;
  PaceCarIdx: number;
  DriverHeadPosX: number;
  DriverHeadPosY: number;
  DriverHeadPosZ: number;
  DriverCarIsElectric: number;
  DriverCarIdleRPM: number;
  DriverCarRedLine: number;
  DriverCarEngCylinderCount: number;
  DriverCarFuelKgPerLtr: number;
  DriverCarFuelMaxLtr: number;
  DriverCarMaxFuelPct: number;
  DriverCarGearNumForward: number;
  DriverCarGearNeutral: number;
  DriverCarGearReverse: number;
  DriverCarSLFirstRPM: number;
  DriverCarSLShiftRPM: number;
  DriverCarSLLastRPM: number;
  DriverCarSLBlinkRPM: number;
  DriverCarVersion: string;
  DriverPitTrkPct: number;
  DriverCarEstLapTime: number;
  DriverSetupName: string;
  DriverSetupIsModified: number;
  DriverSetupLoadTypeName: string;
  DriverSetupPassedTech: number;
  DriverIncidentCount: number;
  DriverBrakeCurvingFactor: number;
  DriverTires: Tire[];
  Drivers: Driver[];
}
