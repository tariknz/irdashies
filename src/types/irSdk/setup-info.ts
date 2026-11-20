export interface TireInfo {
  StartingPressure: string;
  LastHotPressure: string;
  LastTempsOMI: string;
  TreadRemaining: string;
}

export interface TireCompoundInfo {
  TireCompound: string;
}

// Is this for everything, or just for the W12?
export interface AeroPackageInfo {
  DownforceTrim: string;
  FrontFlapOffset: string;
  RearWingGurney: string;
}

export interface AeroCalculatorInfo {
  FrontRhAtSpeed: string;
  RearRhAtSpeed: string;
  AeroBalance: string;
  DownforceToDrag: string;
}

export interface TiresAeroInfo {
  TireCompound: TireCompoundInfo;
  LeftFrontTire: TireInfo;
  LeftRearTire: TireInfo;
  RightFrontTire: TireInfo;
  RightRearTire: TireInfo;
  AeroPackage: AeroPackageInfo;
  AeroCalculator: AeroCalculatorInfo;
}

export interface ChassisCornerInfo {
  CornerWeight: string;
  Camber: string;
  ToeIn?: string;
  ColdPressure?: string;
  LastHotPressure?: string;
  LastTempsOMI?: string;
  TreadRemaining?: string;
  RideHeight?: string;
  SpringPerchOffset?: string;
  BumpStiffness?: string;
  ReboundStiffness?: string;
}

export interface ChassisFrontInfo {
  ToeIn?: string;
  CrossWeight?: string;
  AntiRollBar?: string;
  // W12 stuff
  TransparentHalo?: number; // bool
  WeightDist?: string;
  HeaveRate?: string;
  RollRate?: string;
  RideHeight?: string;
}

export interface ChassisRearInfo {
  FuelLevel: string;
  ToeIn?: string;
  AntiRollBar: string;
  // W12 stuff
  HeaveRate?: string;
  RollRate?: string;
  RideHeight?: string;
}

export interface ChassisInfo {
  Front: ChassisFrontInfo;
  LeftFront: ChassisCornerInfo;
  LeftRear: ChassisCornerInfo;
  RightFront: ChassisCornerInfo;
  RightRear: ChassisCornerInfo;
  Rear: ChassisRearInfo;
}

export interface DifferentialInfo {
  Preload: string;
  Entry: string;
  Middle: string;
  HighSpeed: string;
}

export interface PowerUnitConfig {
  MguKDeployMode: string;
  EngineBraking: string;
}

export interface BrakeSystemConfig {
  BaseBrakeBias: string;
  DynamicRamping: string;
  BrakeMigration: string;
  TotalBrakeBias: string;
  BrakeMagicModifier: number;
}

export interface DriveBrakeInfo {
  Differential: DifferentialInfo;
  PowerUnitConfig: PowerUnitConfig;
  BrakeSystemConfig: BrakeSystemConfig;
}

export interface CarSetupInfo {
  UpdateCount: number;
  Suspension?: ChassisInfo;
  TiresAero?: TiresAeroInfo;
  Chassis?: ChassisInfo;
  DriveBrake?: DriveBrakeInfo;
}
