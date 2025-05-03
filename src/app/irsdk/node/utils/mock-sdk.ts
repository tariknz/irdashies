import type { INativeSDK } from '../../native';
import type {
  TelemetryVarList, TelemetryVariable, BroadcastMessages, CameraState, ReplayPositionCommand, ReplaySearchCommand, ReplayStateCommand, ReloadTexturesCommand, ChatCommand, PitCommand, TelemetryCommand, FFBCommand, VideoCaptureCommand,
} from '../../types';

import { loadMockSessionData, loadMockTelemetry } from './mock-data/loader';

let mockTelemetry: TelemetryVarList | null = null;
let MOCK_SESSION: string | null = null;

export class MockSDK implements INativeSDK {
  public currDataVersion: number;

  public enableLogging: boolean;

  private _isRunning: boolean;

  constructor() {
    this.currDataVersion = 1;
    this.enableLogging = false;
    this._isRunning = false;
    void this._loadMockData();
    console.warn(
      'Attempting to access iRacing SDK on unsupported platform!',
      '\nReturning mock SDK for testing purposes. (Only win32 supported)',
    );
  }

  private async _loadMockData(): Promise<void> {
    const [session, telemetry] = await Promise.all([
      !MOCK_SESSION ? loadMockSessionData() : Promise.resolve(MOCK_SESSION),
      !mockTelemetry ? loadMockTelemetry() : Promise.resolve(mockTelemetry),
    ]);
    MOCK_SESSION = session;
    mockTelemetry = telemetry;
  }

  public startSDK(): boolean {
    this._isRunning = true;
    return true;
  }

  public stopSDK(): void {
    this._isRunning = false;
  }

  public isRunning(): boolean {
    return this._isRunning && MOCK_SESSION !== null && mockTelemetry !== null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public waitForData(_timeout?: number): boolean {
    return this._isRunning;
  }

  public getSessionData(): string {
    return MOCK_SESSION ?? '';
  }

  public getTelemetryData(): TelemetryVarList {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return mockTelemetry!;
  }

  public getTelemetryVariable<T extends boolean | number | string>(index: number): TelemetryVariable<T[]>;

  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public getTelemetryVariable<T extends boolean | number | string>(name: keyof TelemetryVarList): TelemetryVariable<T[]>;

  // Really need to fix the types here.
  public getTelemetryVariable<T extends boolean | number | string>(name: keyof TelemetryVarList | number): TelemetryVariable<T[]> {
    if (typeof name === 'number') {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Object.values(mockTelemetry!)[name] as TelemetryVariable<T[]>;
    }
    return mockTelemetry?.[name] as TelemetryVariable<T[]>;
  }

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

  public broadcast(...args: number[]): void {
    console.log('Pretending to trigger SDK call:', ...args);
  }
}
