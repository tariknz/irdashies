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
   CarIsPaceCar: number; // bool?
   CarIsAI: number; // bool?
   CarScreenName: string;
   CarScreenNameShort: string;
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
   CarNumberDesignStr: string;
   CarSponsor_1: number;
   CarSponsor_2: number;
   CurDriverIncidentCount: number;
   TeamIncidentCount: number;
}

export interface DriverInfo {
  DriverCarIdx: number;
 DriverUserID: number;
 PaceCarIdx: number;
 DriverHeadPosX: number;
 DriverHeadPosY: number;
 DriverHeadPosZ: number;
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
 Drivers: Driver[];
}
