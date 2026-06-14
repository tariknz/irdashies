export enum SessionState {
  Invalid = 0,
  GetInCar,
  Warmup,
  ParadeLaps,
  Racing,
  Checkered,
  CoolDown,
}

export enum GlobalFlags {
  // Global
  Checkered = 0x00000001,
  White = 0x00000002,
  Green = 0x00000004,
  Yellow = 0x00000008,
  Red = 0x00000010,
  Blue = 0x00000020,
  Debris = 0x00000040,
  Crossed = 0x00000080,
  YellowWaving = 0x00000100,
  OneLapToGreen = 0x00000200,
  GreenHeld = 0x00000400,
  TenToGo = 0x00000800,
  FiveToGo = 0x00001000,
  RandomWaving = 0x00002000,
  Caution = 0x00004000,
  CautionWaving = 0x00008000,

  // Drivers black flags
  Black = 0x00010000,
  Disqualify = 0x00020000,
  Servicible = 0x00040000,
  Furled = 0x00080000,
  Repair = 0x00100000,
  /** Car is disqualified and scoring is disabled */
  DqScoringInvalid = 0x00200000,

  // Start lights
  StartHidden = 0x10000000,
  StartReady = 0x20000000,
  StartSet = 0x40000000,
  StartGo = 0x80000000,
}

export enum EngineWarnings {
  WaterTempWarning = 0x0001,
  FuelPressureWarning = 0x0002,
  OilPressureWarning = 0x0004,
  EngineStalled = 0x0008,
  PitSpeedLimiter = 0x0010,
  RevLimiterActive = 0x0020,
  OilTempWarning = 0x0040,
  /** Car needs mandatory repairs */
  MandRepNeeded = 0x0080,
  /** Car needs optional repairs */
  OptRepNeeded = 0x0100,
}

/**
 * Track wetness / rain state.
 * Reported by the `TrackWetness` telemetry variable.
 */
export enum TrackWetness {
  Unknown = 0,
  Dry,
  MostlyDry,
  VeryLightlyWet,
  LightlyWet,
  ModeratelyWet,
  VeryWet,
  ExtremelyWet,
}

export enum PitSvFlags {
  LFTireChange = 0x0001,
  RFTireChange = 0x0002,
  LRTireChange = 0x0004,
  RRTireChange = 0x0008,
  // Non-tires
  FuelFill = 0x0010,
  WindshieldTearoff = 0x0020,
  FastRepair = 0x0040,
}

export enum PitSvStatus {
  // Status
  None = 0,
  InProgress,
  Complete,

  // Errors
  TooFarLeft = 100,
  TooFarRight,
  TooFarForward,
  TooFarBack,
  BadAngle,
  CantFixThat,
}

export enum PaceMode {
  SingleFileStart = 0,
  DoubleFileStart,
  SingleFileRestart,
  DoubleFileRestart,
  NotPacing,
}

export enum PaceFlags {
  EndOfLine = 0x0001,
  FreePass = 0x0002,
  WavedAround = 0x0004,
}

/**
 * Incident report/penalty bitfield.
 * The low byte is the incident report; the high byte is the penalty.
 * Mask with `IncidentReportMask` / `IncidentPenaltyMask` to separate them.
 */
export enum IncidentFlags {
  // Incident report (low byte) — only one will be set
  /** No penalty */
  RepNoReport = 0x0000,
  /** "Loss of Control (2x)" */
  RepOutOfControl = 0x0001,
  /** "Off Track (1x)" */
  RepOffTrack = 0x0002,
  /** Not currently sent */
  RepOffTrackOngoing = 0x0003,
  /** "Contact (0x)" */
  RepContactWithWorld = 0x0004,
  /** "Contact (2x)" */
  RepCollisionWithWorld = 0x0005,
  /** Not currently sent */
  RepCollisionWithWorldOngoing = 0x0006,
  /** "Car Contact (0x)" */
  RepContactWithCar = 0x0007,
  /** "Car Contact (4x)" */
  RepCollisionWithCar = 0x0008,

  // Incident penalty (high byte) — only one will be set
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values -- distinct penalty-byte value that coincides with RepNoReport
  PenNoReport = 0x0000,
  PenZeroX = 0x0100,
  PenOneX = 0x0200,
  PenTwoX = 0x0300,
  PenFourX = 0x0400,

  // Masks to separate the report field from the penalty field
  IncidentReportMask = 0x000000ff,
  IncidentPenaltyMask = 0x0000ff00,
}

export enum CarLeftRight {
  Off,
  /** No cars around us */
  Clear,
  /** Car to our left */
  CarLeft,
  /** Car to our right */
  CarRight,
  /** Cars on both sides  */
  CarLeftRight,
  /** 2 cars to our left */
  Cars2Left,
  /** 2 cars to our right */
  Cars2Right,
}

export enum TrackLocation {
  NotInWorld = -1,
  OffTrack,
  InPitStall,
  ApproachingPits,
  OnTrack,
}

// Enums
export interface VarTypes {
  0: string;
  1: boolean;
  2: number;
  3: number;
  4: number;
  5: number;
}

export enum BroadcastMessages {
  /** Switch the camera position. */
  CameraSwitchPos = 0,
  /** Switch the driver number to follow.  */
  CameraSwitchNum,
  /** Change the camera state. */
  CameraSetState,
  /** Change the play speed of a replay. */
  ReplaySetPlaySpeed,
  /** Jump to a different part of the replay. */
  ReplaySetPlayPosition,
  /** Enter replay search mode. */
  ReplaySearch,
  /** Change the replay state.  */
  ReplaySetState,
  /** Trigger a texture reload. */
  ReloadTextures,
  /** Broadcast a chat command. */
  ChatCommand,
  /** Broadcast a pit command. */
  PitCommand,
  /** Broadcast a telemetry command. */
  TelemCommand,
  /** Broadcast a force feedback command. */
  FFBCommand,
  /** Trigger searching to a replay time. */
  ReplaySearchSessionTime,
  /** Trigger video capture. */
  VideoCapture,
  /** Unused. */
  Last,
}

export enum CameraState {
  /** the camera tool can only be activated if viewing the session screen (out of car) */
  irsdk_IsSessionScreen = 0x0001,
  /** the scenic camera is active (no focus car) */
  irsdk_IsScenicActive = 0x0002,
  /** CAN be changed with a broadcast message */
  irsdk_CamToolActive = 0x0004,
  /** CAN be changed with a broadcast message */
  irsdk_UIHidden = 0x0008,
  /** CAN be changed with a broadcast message */
  irsdk_UseAutoShotSelection = 0x0010,
  /** CAN be changed with a broadcast message */
  irsdk_UseTemporaryEdits = 0x0020,
  /** CAN be changed with a broadcast message */
  irsdk_UseKeyAcceleration = 0x0040,
  /** CAN be changed with a broadcast message */
  irsdk_UseKey10xAcceleration = 0x0080,
  /** CAN be changed with a broadcast message */
  irsdk_UseMouseAimMode = 0x0100,
}

export enum ChatCommand {
  /** Number from 1-15, representing the chat macros.  */
  Macro = 0,
  /** Open up new chat window. */
  BeginChat,
  /** Reply to last private chat. */
  Reply,
  /** Close chat. */
  Cancel,
}

/** Only works when the driver is in the car! */
export enum PitCommand {
  /** Clear all pit checkboxes */
  Clear = 0,
  /** Clean the winshield, using one tear off */
  WS,
  /** Add fuel, optionally specify the amount to add in liters or pass '0' to use existing amount */
  Fuel,
  /** Change the left front tire, optionally specifying the pressure in KPa or pass '0' to use existing pressure */
  LF,
  /** right front */
  RF,
  /** left rear */
  LR,
  /** right rear */
  RR,
  /** Clear tire pit checkboxes */
  ClearTires,
  /** Request a fast repair */
  FR,
  /** Uncheck Clean the windshield checkbox */
  ClearWS,
  /** Uncheck request a fast repair */
  ClearFR,
  /** Uncheck add fuel */
  ClearFuel,
  /** Change tire compound */
  TC,
}

export enum TelemetryCommand {
  /** Turn telemetry recording off */
  Stop = 0,
  /** Turn telemetry recording on */
  Start,
  /** Write current file to disk and start a new one */
  Restart,
}

export enum ReplayStateCommand {
  /** clear any data in the replay tape */
  EraseTape = 0,
  /** unused place holder */
  Last,
}

export enum ReloadTexturesCommand {
  /** reload all textures */
  All = 0,
  /** reload only textures for the specific car index */
  CarIndex,
}

export enum ReplaySearchCommand {
  /** Start of session */
  ToStart = 0,
  /** End of session */
  ToEnd,
  /** Previous session */
  PrevSession,
  /** Next session */
  NextSession,
  /** Previous lap */
  PrevLap,
  /** Next lap */
  NextLap,
  /** Previous frame */
  PrevFrame,
  /** Next frame */
  NextFrame,
  /** Previous incident */
  PrevIncident,
  /** Next incident */
  NextIncident,
  /** Unused */
  Last,
}

export enum ReplayPositionCommand {
  /** Beginning of the replay */
  Begin = 0,
  /** Current position in the replay */
  Current,
  /** End of the replay */
  End,
  /** Unused */
  Last,
}

export enum FFBCommand {
  /** Set the maximum force when mapping steering torque force to direct input units (float in Nm) */
  MaxForce = 0,
  /** Unused */
  Last,
}

/**
 * Used with BroadcastMessages.CameraSwitchPos and BroadcastMessages.CameraSwitchNum.
 * Pass these in for the first parameter to select the 'focus at' types in the camera system.
 * @todo: Not sure this will work with TS like it does in C++ :D
 */
export enum CameraFocusCommand {
  FocusAtIncident = -3,
  FocusAtLeader = -2,
  FocusAtExiting = -1,
  /** FocusAtDriver + car number... */
  FocusAtDriver = 0,
}

export enum VideoCaptureCommand {
  /** save a screenshot to disk */
  TriggerScreenShot = 0,
  /** start capturing video */
  StartVideoCapture,
  /** stop capturing video */
  EndVideoCapture,
  /** toggle video capture on/off */
  ToggleVideoCapture,
  /** show video timer in upper left corner of display */
  ShowVideoTimer,
  /** hide video timer */
  HideVideoTimer,
}
