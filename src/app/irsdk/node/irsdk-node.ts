import yaml from 'js-yaml';
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
  CameraInfo,
  CarSetupInfo,
  DriverInfo,
  RadioInfo,
  SessionList,
  SplitTimeInfo,
  WeekendInfo,
  SessionData,
} from '../types';
import type { INativeSDK } from '../native';

import { getSimStatus } from './utils';
import { getSdkOrMock } from './get-sdk';

function copyTelemData<
K extends keyof TelemetryVarList = keyof TelemetryVarList,
T extends TelemetryVarList[K] = TelemetryVarList[K]
>(src: T, key: K, dest: TelemetryVarList): void {
  dest[key] = { ...src };
  // bool
  if (src.varType === 1) {
    dest[key].value = [];
    const arr = new Int8Array(src.value as number[]);
    arr.forEach((val, i) => {
      dest[key].value[i] = !!val;
    });
    return;
  }
  // numbers
  if (src.varType === 2 || src.varType === 3) { // int
    dest[key].value = [...new Int32Array(src.value as number[])];
  } else if (src.varType === 4) { // float
    dest[key].value = [...new Float32Array(src.value as number[])];
  } else if (src.varType === 5) { // double
    dest[key].value = [...new Float64Array(src.value as number[])];
  }
}

export class IRacingSDK {
  // Public
  /**
   * Enable attempting to auto-start telemetry when starting the SDK (if it is not running).
   * @default false
   */
  public autoEnableTelemetry = false;

  // Private
  private _dataVer = -1;

  private _sessionData: SessionData | null = null;

  private _sdk?: INativeSDK;

  private _sdkReq: Promise<void>;

  constructor() {
    this._sdkReq = this._loadSDK();
    void IRacingSDK.IsSimRunning();
  }

  private async _loadSDK(): Promise<void> {
    const sdk = await getSdkOrMock();
    this._sdk = sdk;
    this._sdk.startSDK();
  }

  public async ready(): Promise<boolean> {
    await this._sdkReq;
    return true;
  }

  /**
   * The current version number of the session data. Increments internally every time data changes.
   * @property {number}
   * @readonly
   */
  public get currDataVersion(): number {
    return this._sdk?.currDataVersion ?? -1;
  }

  /** Whether or not to enable verbose logging in the SDK.
   * @property {boolean}
   */
  public get enableLogging(): boolean {
    return this._sdk?.enableLogging ?? false;
  }

  public set enableLogging(value: boolean) {
    if (this._sdk) this._sdk.enableLogging = value;
  }

  // @todo: add getter for current session string version

  /**
   * Checks whether the simulation service is running.
   * @returns {boolean} True if the service is running.
   */
  public static async IsSimRunning(): Promise<boolean> {
    try {
      const result = await getSimStatus();
      return result;
    } catch (e) {
      console.error('Could not successfully determine sim status:', e);
    }
    return false;
  }

  public get sessionStatusOK(): boolean {
    return this._sdk?.isRunning() ?? false;
  }

  /**
   * Starts the native iRacing SDK and begins subscribing for data.
   * @returns {boolean} If the SDK started successfully.
   */
  public startSDK(): boolean {
    if (!this._sdk?.isRunning()) {
      const successful = this._sdk?.startSDK() ?? false;
      if (this.autoEnableTelemetry) {
        this.enableTelemetry(true);
      }
      return successful;
    }
    return true;
  }

  /**
   * Stops the SDK from running and resets the data version.
   */
  public stopSDK(): void {
    this._sdk?.stopSDK();
    this._dataVer = -1;
  }

  /**
   * Wait for new data from the sdk.
   * @param {number} timeout Timeout (in ms). Max is 60fps (1/60)
   */
  public waitForData(timeout?: number): boolean {
    return this._sdk?.waitForData(timeout) ?? false;
  }

  /**
   * Gets the current session data (from yaml format).
   * @returns {SessionData}
   */
  public getSessionData(): SessionData | null {
    if (this._sessionData && this._dataVer === this.currDataVersion) return this._sessionData;
    if (!this._sdk) return null;

    try {
      const seshString = this._sdk?.getSessionData();
      // Remove trailing commas
      const fixedYaml = seshString?.replace(/(\w+):\s*,\s*\n/g, '$1: \n');
      this._sessionData = yaml.load(fixedYaml, { json: true }) as SessionData;
      this._dataVer = this.currDataVersion;
      return this._sessionData;
    } catch (err) {
      console.error('There was an error getting session data:', err);
    }

    return null;
  }

  /**
   * Gets the current weekend info from the session data
   * @returns {WeekendInfo}
   */
  public getWeekendInfo(): WeekendInfo | null {
    const session = this.getSessionData();
    return session?.WeekendInfo ?? null;
  }

  /**
   * Gets the current session info from the session data.
   * @returns {SessionInfo}
   */
  public getSessionInfo(): SessionList | null {
    const session = this.getSessionData();
    return session?.SessionInfo ?? null;
  }

  /**
   * Gets the current camera info from the session data.
   * @returns {CameraInfo}
   */
  public getCameraInfo(): CameraInfo | null {
    const session = this.getSessionData();
    return session?.CameraInfo ?? null;
  }

  /**
   * Gets the current radio info from the session data.
   * @returns {RadioInfo}
   */
  public getRadioInfo(): RadioInfo | null {
    const session = this.getSessionData();
    return session?.RadioInfo ?? null;
  }

  /**
   * Gets the current driver info from the session data.
   * @returns {DriverInfo}
   */
  public getDriverInfo(): DriverInfo | null {
    const session = this.getSessionData();
    return session?.DriverInfo ?? null;
  }

  /**
   * Gets the current split time info from the session data.
   * @returns {SplitTimeInfo}
   */
  public getSplitInfo(): SplitTimeInfo | null {
    const session = this.getSessionData();
    return session?.SplitTimeInfo ?? null;
  }

  /**
   * Gets the current session info from the session data.
   * @returns {CarSetupInfo}
   */
  public getCarSetupInfo(): CarSetupInfo | null {
    const session = this.getSessionData();
    return session?.CarSetup ?? null;
  }

  /**
   * Get the current value of the telemetry variables.
   */
  public getTelemetry(): TelemetryVarList {
    const rawData = this._sdk?.getTelemetryData();
    const data: Partial<TelemetryVarList> = {};

    if (rawData) {
      Object.keys(rawData).forEach((dataKey) => {
        copyTelemData(
          rawData[dataKey as keyof TelemetryVarList],
          dataKey as keyof TelemetryVarList,
          data as TelemetryVarList,
        );
      });
    }

    return data as TelemetryVarList;
  }

  /**
   * Request the value of the given telemetry variable.
   * @param index The number index of the variable. Only use if you know what you are doing!
   */
  public getTelemetryVariable<T extends boolean | number | string>(index: number): TelemetryVariable<T[]> | null;

  /**
   * Request the value of the given telemetry variable.
   * @param varName The name of the variable to retrieve.
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  public getTelemetryVariable<T extends boolean | number | string>(varName: keyof TelemetryVarList): TelemetryVariable<T[]> | null;

  public getTelemetryVariable<T extends boolean | number | string>(telemVar: number | keyof TelemetryVarList): TelemetryVariable<T[]> | null {
    if (!this._sdk) return null;

    // @todo Need to fix this type.
    const rawData = this._sdk?.getTelemetryVariable(telemVar as string);
    const parsed: Partial<TelemetryVarList> = {};

    // @todo good grief these types need to be fixed asap
    copyTelemData(
      rawData as TelemetryVariable<any>, // eslint-disable-line
      rawData.name as keyof TelemetryVarList,
      parsed as TelemetryVarList,
    );

    return parsed[rawData.name as keyof TelemetryVarList] as TelemetryVariable<T[]>;
  }

  // Broadcast commands
  public enableTelemetry(enabled: boolean): void {
    const command = enabled ? TelemetryCommand.Start : TelemetryCommand.Stop;
    this._sdk?.broadcast(BroadcastMessages.TelemCommand, command);
  }

  public restartTelemetry(): void {
    this._sdk?.broadcast(BroadcastMessages.TelemCommand, TelemetryCommand.Restart);
  }

  public changeCameraPosition(position: number, group: number, camera: number): void {
    this._sdk?.broadcast(BroadcastMessages.CameraSwitchPos, position, group, camera);
  }

  // @todo: needs to be padded
  public changeCameraNumber(driver: number, group: number, camera: number): void {
    this._sdk?.broadcast(BroadcastMessages.CameraSwitchNum, driver, group, camera);
  }

  public changeCameraState(state: CameraState): void {
    this._sdk?.broadcast(BroadcastMessages.CameraSetState, state);
  }

  public changeReplaySpeed(speed: number, slowMotion: boolean): void {
    this._sdk?.broadcast(BroadcastMessages.ReplaySetPlaySpeed, speed, slowMotion ? 1 : 0);
  }

  public changeReplayPosition(position: ReplayPositionCommand, frame: number): void {
    this._sdk?.broadcast(BroadcastMessages.ReplaySetPlayPosition, position, frame);
  }

  public searchReplay(command: ReplaySearchCommand): void {
    this._sdk?.broadcast(BroadcastMessages.ReplaySearch, command);
  }

  public changeReplayState(state: ReplayStateCommand): void {
    this._sdk?.broadcast(BroadcastMessages.ReplaySetState, state);
  }

  public triggerReplaySessionSearch(session: number, time: number): void {
    this._sdk?.broadcast(BroadcastMessages.ReplaySearchSessionTime, session, time);
  }

  public reloadAllTextures(): void {
    this._sdk?.broadcast(BroadcastMessages.ReloadTextures, ReloadTexturesCommand.All, 0);
  }

  public reloadCarTextures(car: number): void {
    this._sdk?.broadcast(BroadcastMessages.ReloadTextures, ReloadTexturesCommand.CarIndex, car);
  }

  public triggerChatState(state: ChatCommand.BeginChat | ChatCommand.Cancel | ChatCommand.Reply): void {
    this._sdk?.broadcast(BroadcastMessages.ChatCommand, state, 1);
  }

  /**
   * @param {number} macro Between 1 - 15
   */
  public triggerChatMacro(macro: number): void {
    const clamped = Math.min(15, Math.max(1, macro));
    this._sdk?.broadcast(BroadcastMessages.ChatCommand, ChatCommand.Macro, clamped);
  }

  public triggerPitClearCommand(
    command: PitCommand.Clear | PitCommand.ClearTires | PitCommand.ClearWS | PitCommand.ClearFR | PitCommand.ClearFuel,
  ): void {
    this._sdk?.broadcast(BroadcastMessages.PitCommand, command);
  }

  public triggerPitCommand(
    command: PitCommand.WS | PitCommand.FR,
  ): void {
    this._sdk?.broadcast(BroadcastMessages.PitCommand, command);
  }

  public triggerPitChange(
    command: PitCommand.Fuel | PitCommand.LF | PitCommand.RF | PitCommand.LR | PitCommand.RR,
    amount: number,
  ): void {
    this._sdk?.broadcast(BroadcastMessages.PitCommand, command, amount);
  }

  public changeFFB(mode: FFBCommand, amount: number): void {
    this._sdk?.broadcast(BroadcastMessages.FFBCommand, mode, amount);
  }

  public triggerVideoCapture(command: VideoCaptureCommand): void {
    this._sdk?.broadcast(BroadcastMessages.VideoCapture, command);
  }
}
