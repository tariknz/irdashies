import * as yaml from 'js-yaml';
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
} from '../../../types/irSdk';
import type { INativeSDK, NativeTelemetryDataView } from '../native';

import { getSimStatus } from './utils';
import { getSdkOrMock } from './get-sdk';
import logger from '../../logger';
import type { TapeReplayCommand, TapeReplayStatus } from '@irdashies/types';

/**
 * Encodes a car number string for irsdk_BroadcastCamSwitchNum, mirroring the
 * SDK's irsdk_padCarNum: a number padded with N leading zeros is sent as
 * num + 1000 * (digitCount + N), so "30", "030" and "0030" stay distinct.
 *
 * Leading zeros are derived by length difference rather than a /^0+/ match,
 * because for an all-zero number like "00" the match would also consume the
 * significant digit and over-count the padding by one.
 */
function padCarNum(carNumber: string): number {
  const num = parseInt(carNumber, 10);
  if (isNaN(num)) return 0;
  const leadingZeros = carNumber.trim().length - String(num).length;
  if (leadingZeros <= 0) return num;
  const numPlaces = (num > 99 ? 3 : num > 9 ? 2 : 1) + leadingZeros;
  return num + 1000 * numPlaces;
}

type TelemetryArrayView = Int8Array | Int32Array | Float32Array | Float64Array;

interface CachedTelemetryView {
  source: ArrayBuffer | Uint8Array;
  varType: number;
  view: TelemetryArrayView;
  scratch?: Uint8Array;
}

type TelemetryViewCache = Map<string, CachedTelemetryView>;
type TelemetryTypeCache = Map<string, number>;

const createTelemetryView = (
  value: unknown,
  varType: number
): TelemetryArrayView => {
  const make = <T extends TelemetryArrayView>(View: {
    new (values: ArrayLike<number>): T;
    new (buffer: ArrayBufferLike, byteOffset: number, length: number): T;
    readonly BYTES_PER_ELEMENT: number;
  }): T => {
    if (value instanceof Uint8Array) {
      const bytes =
        value.byteOffset % View.BYTES_PER_ELEMENT === 0 ? value : value.slice();
      return new View(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength / View.BYTES_PER_ELEMENT
      );
    }
    if (value instanceof ArrayBuffer) {
      return new View(value, 0, value.byteLength / View.BYTES_PER_ELEMENT);
    }
    return new View(value as ArrayLike<number>);
  };

  switch (varType) {
    case 1:
      return make(Int8Array);
    case 2:
    case 3:
      return make(Int32Array);
    case 4:
      return make(Float32Array);
    case 5:
      return make(Float64Array);
    default:
      return new Int32Array(0);
  }
};

const telemetryView = (
  src: { value?: unknown; varType?: number },
  key: string,
  views?: TelemetryViewCache
): TelemetryArrayView => {
  const rawValue = src.value;
  const varType = src.varType ?? 0;
  const cached = views?.get(key);
  if (cached && cached.source === rawValue && cached.varType === varType) {
    if (rawValue instanceof Uint8Array) cached.scratch?.set(rawValue);
    return cached.view;
  }

  const view = createTelemetryView(rawValue, varType);
  if (
    views &&
    (rawValue instanceof Uint8Array || rawValue instanceof ArrayBuffer)
  ) {
    const scratch =
      rawValue instanceof Uint8Array &&
      view.byteLength > 0 &&
      rawValue.buffer !== view.buffer
        ? new Uint8Array(view.buffer)
        : undefined;
    views.set(key, { source: rawValue, varType, view, scratch });
  }
  return view;
};

function copyTelemData<
  K extends keyof TelemetryVarList = keyof TelemetryVarList,
  T extends TelemetryVarList[K] = TelemetryVarList[K],
>(
  src: T | NativeTelemetryDataView[K],
  key: K,
  dest: TelemetryVarList,
  cache?: Partial<TelemetryVarList>,
  views?: TelemetryViewCache,
  varTypes?: TelemetryTypeCache
): void {
  const previousType = varTypes?.get(key);
  const typeChanged =
    previousType !== undefined && previousType !== src.varType;
  varTypes?.set(key, src.varType);
  // Check if we have a cached entry to reuse
  const cached = cache?.[key];
  const useCache =
    !typeChanged && cached && cached.value && Array.isArray(cached.value);
  if (!useCache) {
    dest[key] = {
      value:
        src?.value instanceof Uint8Array
          ? src.varType === 0
            ? src.value.slice().buffer
            : []
          : (src?.value ?? []),
    } as TelemetryVarList[K];
  } else {
    dest[key] = cached;
  }

  // bool
  if (src.varType === 1) {
    const arr = telemetryView(src, key, views) as Int8Array;
    const targetArray = useCache ? (dest[key].value as boolean[]) : [];
    if (!useCache) {
      dest[key].value = targetArray;
    } else {
      targetArray.length = arr.length;
    }
    // Reuse array by updating in-place
    for (let i = 0; i < arr.length; i++) {
      targetArray[i] = !!arr[i];
    }
    return;
  }
  // numbers
  if (src.varType === 2 || src.varType === 3) {
    // int
    const srcArray = telemetryView(src, key, views) as Int32Array;
    if (useCache) {
      const targetArray = dest[key].value as number[];
      targetArray.length = srcArray.length;
      for (let i = 0; i < srcArray.length; i++) {
        targetArray[i] = srcArray[i];
      }
    } else {
      dest[key].value = [...srcArray];
    }
  } else if (src.varType === 4) {
    // float
    const srcArray = telemetryView(src, key, views) as Float32Array;
    if (useCache) {
      const targetArray = dest[key].value as number[];
      targetArray.length = srcArray.length;
      for (let i = 0; i < srcArray.length; i++) {
        targetArray[i] = srcArray[i];
      }
    } else {
      dest[key].value = [...srcArray];
    }
  } else if (src.varType === 5) {
    // double
    const srcArray = telemetryView(src, key, views) as Float64Array;
    if (useCache) {
      const targetArray = dest[key].value as number[];
      targetArray.length = srcArray.length;
      for (let i = 0; i < srcArray.length; i++) {
        targetArray[i] = srcArray[i];
      }
    } else {
      dest[key].value = [...srcArray];
    }
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

  // One-entry cache of the last attempted input (including rejected YAML).
  // Keep reading native data: its version only refreshes as a side effect.
  private _sessionInput: string | null = null;

  private _sdk?: INativeSDK;

  private _sdkReq: Promise<void>;

  // Cache for telemetry data to avoid repeated array allocations
  private _telemetryCache: Partial<TelemetryVarList> = {};
  private _telemetryKeys: (keyof TelemetryVarList)[] = [];
  private _lastRawTelemetry:
    TelemetryVarList | NativeTelemetryDataView | undefined;
  private _telemetryViews: TelemetryViewCache = new Map();
  private _telemetryVarTypes: TelemetryTypeCache = new Map();

  constructor() {
    this._sdkReq = this._loadSDK();
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
      logger.error('Could not successfully determine sim status:', e);
    }
    return false;
  }

  public get sessionStatusOK(): boolean {
    const running = this._sdk?.isRunning() ?? false;
    if (!running) this.resetSessionData();
    return running;
  }

  private static quoteTextValue(value: string): string {
    // JSON escapes backslashes, quotes, CR and C0 controls. YAML also treats
    // NEL/Unicode separators as line breaks, so escape those without losing them.
    return JSON.stringify(value).replace(
      /[\u007f-\u009f\u2028\u2029]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
  }

  /** Preserve complete flow values, including their nested/multiline contents. */
  private static flowCollectionEnd(
    lines: string[],
    start: number,
    value: string,
    keyIndent: number
  ): number | null {
    let end = start + 1;
    while (end < lines.length) {
      const line = lines[end];
      if (
        /^---|^\.\.\./.test(line) ||
        (line.search(/\S/) <= keyIndent && /^[ \t]*(?:-[ \t]+)?\w+:/.test(line))
      )
        break;
      end++;
    }
    try {
      const parsed: unknown = yaml.load(
        [value, ...lines.slice(start + 1, end)].join('\n'),
        { json: true }
      );
      if (parsed !== null && typeof parsed === 'object') return end - 1;
    } catch {
      // A bracketed/braced name followed by text is not a YAML collection.
    }
    return null;
  }

  /**
   * Extend the existing indicator/comma repairs only for known text fields.
   * Track block/quoted scalars so their contents cannot become mapping entries
   * or stray setup-path lines during normalization.
   */
  private static normalizeSessionYaml(yamlText: string): string {
    const lines = yamlText.split('\n');
    let blockIndent = -1;
    let quote: string | null = null;
    const closesQuote = (value: string, delimiter: string) =>
      delimiter === "'"
        ? /^(?:[^']|'')*'/.test(value)
        : /^(?:[^"\\]|\\.)*"/.test(value);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.search(/\S/);
      if (blockIndent >= 0 && (indent === -1 || indent > blockIndent)) continue;
      blockIndent = -1;
      if (quote) {
        if (closesQuote(line, quote)) quote = null;
        continue;
      }
      if (/^[ \t]*-[ \t]+[|>][\d+-]*(?:[ \t]+#.*)?[ \t]*\r?$/.test(line)) {
        blockIndent = indent;
        continue;
      }
      const match = line.match(/^([ \t]*(?:-[ \t]+)?(\w+):[ \t]*)([^\n]*)$/);
      if (!match) continue;
      const [, keyPart, key, rawValue] = match;
      const crlf = rawValue.endsWith('\r') ? '\r' : '';
      let value = crlf ? rawValue.slice(0, -1) : rawValue;
      if (/^[|>][\d+-]*(?:[ \t]+#.*)?[ \t]*$/.test(value)) {
        blockIndent = keyPart.search(/\w/);
        continue;
      }
      if (/^["']/.test(value)) {
        if (!closesQuote(value.slice(1), value[0])) quote = value[0];
        continue;
      }
      const knownTextField =
        /^(?:TeamName|UserName|AbbrevName|Initials|DriverSetupName)$/.test(key);
      const legacyIndicator = /^[?-](?:[ \t]|$)/.test(value);
      if (!knownTextField && !legacyIndicator && !/^,/.test(value)) continue;
      if (/^#/.test(value)) continue;
      if (/^[[{]/.test(value)) {
        const flowEnd = IRacingSDK.flowCollectionEnd(
          lines,
          i,
          value,
          keyPart.search(/\w/)
        );
        if (flowEnd !== null) {
          i = flowEnd;
          continue;
        }
      }
      const leadingIndicator = /^[[{&*!]/.test(value);
      const commentStart = value.search(/[ \t]+#/);
      const comment = commentStart < 0 ? '' : value.slice(commentStart);
      value = (commentStart < 0 ? value : value.slice(0, commentStart)).replace(
        /[ \t]+$/,
        ''
      );

      let merged = false;
      if (key === 'DriverSetupName' && value && !/^#/.test(value)) {
        // Repair the existing corruption case: a setup path split by a literal
        // LF into stray unindented text. Valid indented continuations stay YAML.
        for (let j = i + 1; j < lines.length; j++) {
          const continuation = lines[j];
          if (
            /^\s*$|^\s*#|^\s*(?:-\s+)?\w+:|^\s*-|^\.\.\.|^---/.test(
              continuation
            )
          )
            break;
          if (continuation.search(/\S/) > indent) break;
          value += ` ${continuation.trim()}`;
          lines[j] = '';
          merged = true;
        }
      }
      // Ignore colons inside valid YAML comments. Empty values, numbers,
      // booleans, flow collections, and ordinary scalars retain their types.
      if (value.trim() === ',') {
        lines[i] = `${keyPart}${comment}${crlf}`;
      } else if (
        merged ||
        /^[@,]/.test(value) ||
        legacyIndicator ||
        leadingIndicator ||
        /:(?:[ \t]|$)/.test(value) ||
        // eslint-disable-next-line no-control-regex -- native text can contain literal controls
        /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(value)
      ) {
        lines[i] =
          `${keyPart}${IRacingSDK.quoteTextValue(value)}${comment}${crlf}`;
      }
    }
    return lines.join('\n');
  }

  private resetSessionData(): void {
    this._dataVer = -1;
    this._sessionData = null;
    this._sessionInput = null;
  }

  /**
   * Starts the native iRacing SDK and begins subscribing for data.
   * @returns {boolean} If the SDK started successfully.
   */
  public startSDK(): boolean {
    if (!this._sdk?.isRunning()) {
      this.resetSessionData();
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
    this.resetSessionData();
    this._telemetryCache = {};
    this._telemetryKeys = [];
    this._lastRawTelemetry = undefined;
    this._telemetryViews.clear();
    this._telemetryVarTypes.clear();
  }

  /**
   * Wait for new data from the sdk.
   * @param {number} timeout Timeout (in ms). Max is 60fps (1/60)
   */
  public waitForData(timeout?: number): boolean {
    const result = this._sdk?.waitForData(timeout) ?? false;
    if (this._sdk?.currDataVersion === -1) {
      this.resetSessionData();
    }
    return result;
  }

  public getTapeReplayStatus(): TapeReplayStatus | null {
    return this._sdk?.getTapeReplayStatus?.() ?? null;
  }

  public controlTapeReplay(command: TapeReplayCommand): TapeReplayStatus {
    let accepted = false;
    switch (command.type) {
      case 'seek':
        accepted = this._sdk?.seekTapeReplay?.(command.seconds) ?? false;
        if (accepted) this.resetSessionData();
        break;
      case 'speed':
        accepted = this._sdk?.setTapeReplaySpeed?.(command.speed) ?? false;
        break;
      case 'pause':
        accepted = this._sdk?.setTapeReplayPaused?.(command.paused) ?? false;
        break;
    }
    const status = this.getTapeReplayStatus();
    if (!accepted || !status) throw new Error('Tape replay control failed');
    return status;
  }

  /**
   * Gets the current session data (from yaml format).
   * @returns {SessionData}
   */
  public getSessionData(): SessionData | null {
    if (!this._sdk) return null;

    try {
      if (this.currDataVersion === -1) this.resetSessionData();
      const seshString = this._sdk.getSessionData();
      // currDataVersion is only updated after getSessionData is called
      const version = this.currDataVersion;
      if (!seshString || version === -1) {
        this.resetSessionData();
        return null;
      }
      if (version < this._dataVer) this.resetSessionData();
      if (
        this._sessionInput === seshString &&
        (!this._sessionData || this._dataVer === version)
      ) {
        this._dataVer = version;
        return this._sessionData;
      }
      this._sessionInput = seshString;
      this._dataVer = version;
      this._sessionData = null;

      const fixedYaml = IRacingSDK.normalizeSessionYaml(seshString);
      this._sessionData = yaml.load(fixedYaml, { json: true }) as SessionData;
      return this._sessionData;
    } catch (err) {
      // YAMLException includes the entire session in mark.buffer and may put
      // user text in reason/message (e.g. unknown tags). Never forward it.
      if (err instanceof yaml.YAMLException) {
        const safeReasons = [
          'bad indentation of a mapping entry',
          'bad indentation of a sequence entry',
          'the stream contains non-printable characters',
          'unexpected end of the stream within a flow collection',
        ];
        const errorLine = err.mark?.buffer?.split('\n').at(err.mark.line);
        const key = errorLine?.match(
          /^[ \t]*(?:-[ \t]+)?(TeamName|UserName|AbbrevName|Initials|DriverSetupName|Drivers|DriverInfo|WeekendInfo):/
        )?.[1];
        logger.error('There was an error getting session data:', {
          reason: safeReasons.includes(err.reason)
            ? err.reason
            : 'invalid YAML',
          field: key,
          line: err.mark ? err.mark.line + 1 : undefined,
          column: err.mark ? err.mark.column + 1 : undefined,
        });
      } else {
        this.resetSessionData();
        logger.error('There was an error getting session data:', {
          reason: 'session data read failed',
        });
      }
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
   *
   * The outer object is fresh on every read, but its inner arrays are reused
   * and overwritten on subsequent reads. Telemetry values are mutable frames
   * intended for synchronous consumption only. An async consumer must copy
   * the values it intends to retain.
   */
  public getTelemetry(): TelemetryVarList {
    const rawData = this._sdk?.getTelemetryDataView
      ? this._sdk.getTelemetryDataView()
      : this._sdk?.getTelemetryData();
    const data: Partial<TelemetryVarList> = {};

    if (rawData) {
      if (rawData !== this._lastRawTelemetry) {
        this._telemetryKeys = Object.keys(
          rawData
        ) as (keyof TelemetryVarList)[];
        this._telemetryViews.clear();
        this._lastRawTelemetry = rawData;
      }
      for (const key of this._telemetryKeys) {
        copyTelemData(
          rawData[key],
          key,
          data as TelemetryVarList,
          this._telemetryCache,
          this._telemetryViews,
          this._telemetryVarTypes
        );
      }
      // Update cache with the new data
      this._telemetryCache = data;
    }

    return data as TelemetryVarList;
  }

  /**
   * Request the value of the given telemetry variable.
   * @param telemVar The variable name or numeric index (use index only if you know what you are doing!)
   */
  public getTelemetryVariable<T extends boolean | number | string>(
    telemVar: number | keyof TelemetryVarList
  ): TelemetryVariable<T[]> | null {
    if (!this._sdk) return null;

    const rawData = this._sdk?.getTelemetryVariable(telemVar as string);
    const parsed: Partial<TelemetryVarList> = {};

    copyTelemData(
      rawData as TelemetryVariable,
      rawData.name as keyof TelemetryVarList,
      parsed as TelemetryVarList
    );

    return parsed[rawData.name as keyof TelemetryVarList] as TelemetryVariable<
      T[]
    >;
  }

  // Broadcast commands
  public enableTelemetry(enabled: boolean): void {
    const command = enabled ? TelemetryCommand.Start : TelemetryCommand.Stop;
    this._sdk?.broadcast(BroadcastMessages.TelemCommand, command);
  }

  public restartTelemetry(): void {
    this._sdk?.broadcast(
      BroadcastMessages.TelemCommand,
      TelemetryCommand.Restart
    );
  }

  public changeCameraPosition(
    position: number,
    group: number,
    camera: number
  ): void {
    this._sdk?.broadcast(
      BroadcastMessages.CameraSwitchPos,
      position,
      group,
      camera
    );
  }

  public changeCameraNumber(
    carNumber: string,
    group: number,
    camera: number
  ): void {
    this._sdk?.broadcast(
      BroadcastMessages.CameraSwitchNum,
      padCarNum(carNumber),
      group,
      camera
    );
  }

  public changeCameraState(state: CameraState): void {
    this._sdk?.broadcast(BroadcastMessages.CameraSetState, state);
  }

  public changeReplaySpeed(speed: number, slowMotion: boolean): void {
    this._sdk?.broadcast(
      BroadcastMessages.ReplaySetPlaySpeed,
      speed,
      slowMotion ? 1 : 0
    );
  }

  public changeReplayPosition(
    position: ReplayPositionCommand,
    frame: number
  ): void {
    this._sdk?.broadcast(
      BroadcastMessages.ReplaySetPlayPosition,
      position,
      frame
    );
  }

  public searchReplay(command: ReplaySearchCommand): void {
    this._sdk?.broadcast(BroadcastMessages.ReplaySearch, command);
  }

  public changeReplayState(state: ReplayStateCommand): void {
    this._sdk?.broadcast(BroadcastMessages.ReplaySetState, state);
  }

  public triggerReplaySessionSearch(session: number, time: number): void {
    this._sdk?.broadcast(
      BroadcastMessages.ReplaySearchSessionTime,
      session,
      time
    );
  }

  public reloadAllTextures(): void {
    this._sdk?.broadcast(
      BroadcastMessages.ReloadTextures,
      ReloadTexturesCommand.All,
      0
    );
  }

  public reloadCarTextures(car: number): void {
    this._sdk?.broadcast(
      BroadcastMessages.ReloadTextures,
      ReloadTexturesCommand.CarIndex,
      car
    );
  }

  public triggerChatState(
    state: ChatCommand.BeginChat | ChatCommand.Cancel | ChatCommand.Reply
  ): void {
    this._sdk?.broadcast(BroadcastMessages.ChatCommand, state, 1);
  }

  /**
   * @param {number} macro Between 1 - 15
   */
  public triggerChatMacro(macro: number): void {
    const clamped = Math.min(15, Math.max(1, macro));
    this._sdk?.broadcast(
      BroadcastMessages.ChatCommand,
      ChatCommand.Macro,
      clamped
    );
  }

  public triggerPitClearCommand(
    command:
      | PitCommand.Clear
      | PitCommand.ClearTires
      | PitCommand.ClearWS
      | PitCommand.ClearFR
      | PitCommand.ClearFuel
  ): void {
    this._sdk?.broadcast(BroadcastMessages.PitCommand, command);
  }

  public triggerPitCommand(command: PitCommand.WS | PitCommand.FR): void {
    this._sdk?.broadcast(BroadcastMessages.PitCommand, command);
  }

  public triggerPitChange(
    command:
      | PitCommand.Fuel
      | PitCommand.LF
      | PitCommand.RF
      | PitCommand.LR
      | PitCommand.RR,
    amount: number
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
