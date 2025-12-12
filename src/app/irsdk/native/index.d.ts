import {
  BroadcastMessages,
  CameraState,
  ChatCommand,
  FFBCommand,
  PitCommand,
  ReloadTexturesCommand,
  ReplayPositionCommand,
  ReplaySearchCommand,
  ReplayStateCommand,
  TelemetryCommand,
  VideoCaptureCommand,
  TelemetryVariable,
  TelemetryVarList,
  SessionData,
} from '../types';

type TelemetryTypesDict = Record<string, number>;

export interface INativeSDK {
  readonly currDataVersion: number;
  enableLogging: boolean;

  // Main API
  // Control
  startSDK(): boolean;
  stopSDK(): void;

  // State
  isRunning(): boolean;
  waitForData(timeout?: number): boolean;
  getSessionData(): SessionData;
  getTelemetryData(): TelemetryVarList;

  getTelemetryVariable<T>(index: number): TelemetryVariable<T>;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  getTelemetryVariable<T>(name: string): TelemetryVariable<T>;

  // Broadcast command overloads
  // This is handled in the cpp side so no need to mess with it in js
  broadcast(message: BroadcastMessages.CameraSwitchPos, pos: number, group: number, camera: number): void;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  broadcast(message: BroadcastMessages.CameraSwitchNum, driver: number, group: number, camera: number): void;
  broadcast(message: BroadcastMessages.CameraSetState, state: CameraState): void;
  broadcast(message: BroadcastMessages.ReplaySetPlaySpeed, speed: number, slowMotion: number): void;
  broadcast(message: BroadcastMessages.ReplaySetPlayPosition, pos: ReplayPositionCommand, frame: number): void;
  broadcast(message: BroadcastMessages.ReplaySearch, mode: ReplaySearchCommand): void;
  broadcast(message: BroadcastMessages.ReplaySetState, state: ReplayStateCommand): void;
  broadcast(message: BroadcastMessages.ReloadTextures, command: ReloadTexturesCommand, carIndex?: number): void;
  broadcast(message: BroadcastMessages.ChatCommand, command: ChatCommand, macro?: number): void;
  broadcast(message: BroadcastMessages.PitCommand, command: PitCommand, param?: number): void;
  broadcast(message: BroadcastMessages.TelemCommand, command: TelemetryCommand): void;
  broadcast(message: BroadcastMessages.FFBCommand, command: FFBCommand, value: number): void;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  broadcast(message: BroadcastMessages.ReplaySearchSessionTime, session: number, time: number): void;
  broadcast(message: BroadcastMessages.VideoCapture, command: VideoCaptureCommand): void;
}

export class NativeSDK implements INativeSDK {
  public readonly currDataVersion: number;

  public enableLogging: boolean;

  constructor();

  // Main API
  // Control
  public startSDK(): boolean;

  public stopSDK(): void;

  // State
  public isRunning(): boolean;

  public waitForData(timeout?: number): boolean;

  public getSessionData(): SessionData;

  public getTelemetryData(): TelemetryVarList;

  public getTelemetryVariable<T extends number | boolean | string>(index: number): TelemetryVariable<T[]>;

  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public getTelemetryVariable<T extends number | boolean | string>(name: string): TelemetryVariable<T[]>;

  // Private helpers
  public __getTelemetryTypes(): TelemetryTypesDict;

  // Broadcast command overloads
  // This is handled in the cpp side so no need to mess with it in js
  public broadcast(message: BroadcastMessages.CameraSwitchPos, pos: number, group: number, camera: number): void;

  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public broadcast(message: BroadcastMessages.CameraSwitchNum, driver: number, group: number, camera: number): void;

  public broadcast(message: BroadcastMessages.CameraSetState, state: CameraState): void;

  public broadcast(message: BroadcastMessages.ReplaySetPlaySpeed, speed: number, slowMotion: number): void;

  public broadcast(message: BroadcastMessages.ReplaySetPlayPosition, pos: ReplayPositionCommand, frame: number): void;

  public broadcast(message: BroadcastMessages.ReplaySearch, mode: ReplaySearchCommand): void;

  public broadcast(message: BroadcastMessages.ReplaySetState, state: ReplayStateCommand): void;

  public broadcast(message: BroadcastMessages.ReloadTextures, command: ReloadTexturesCommand, carIndex?: number): void;

  public broadcast(message: BroadcastMessages.ChatCommand, command: ChatCommand, macro?: number): void;

  public broadcast(message: BroadcastMessages.PitCommand, command: PitCommand, param?: number): void;

  public broadcast(message: BroadcastMessages.TelemCommand, command: TelemetryCommand): void;

  public broadcast(message: BroadcastMessages.FFBCommand, command: FFBCommand, value: number): void;

  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public broadcast(message: BroadcastMessages.ReplaySearchSessionTime, session: number, time: number): void;

  public broadcast(message: BroadcastMessages.VideoCapture, command: VideoCaptureCommand): void;
}

// export const DebugSDK: typeof NativeSDK;
