/**
 * Binary layout types for iRacing .ibt telemetry files.
 *
 * An .ibt on disk mirrors the live shared-memory format (see
 * src/app/irsdk/native/lib/irsdk_defines.h): an irsdk_header, then an
 * irsdk_diskSubHeader, then — at the offsets named in the header — the YAML
 * session-info string, the varHeader array, and the sample buffer.
 *
 * All integers/floats are little-endian (Windows). Sizes below come straight
 * from the C structs and are exercised by ibtBinary.spec.ts.
 */

/** irsdk_header — 112 bytes. */
export const IBT_HEADER_SIZE = 112;
/** irsdk_diskSubHeader — 32 bytes, immediately after the header. */
export const IBT_DISK_SUBHEADER_SIZE = 32;
/** irsdk_varHeader — 144 bytes per entry. */
export const IBT_VAR_HEADER_SIZE = 144;

/** Latest telemetry header version this parser understands (IRSDK_VER). */
export const IBT_SUPPORTED_VERSION = 2;

/** irsdk_VarType enum + byte widths, from irsdk_defines.h. */
export enum IbtVarType {
  Char = 0,
  Bool = 1,
  Int = 2,
  BitField = 3,
  Float = 4,
  Double = 5,
}

export const IBT_VAR_TYPE_BYTES: Readonly<Record<IbtVarType, number>> = {
  [IbtVarType.Char]: 1,
  [IbtVarType.Bool]: 1,
  [IbtVarType.Int]: 4,
  [IbtVarType.BitField]: 4,
  [IbtVarType.Float]: 4,
  [IbtVarType.Double]: 8,
};

export interface IbtHeader {
  ver: number;
  status: number;
  tickRate: number;
  sessionInfoUpdate: number;
  sessionInfoLen: number;
  sessionInfoOffset: number;
  numVars: number;
  varHeaderOffset: number;
  numBuf: number;
  /** Length in bytes of one sample record (row). */
  bufLen: number;
  /** Byte offset of the first sample record. From varBuf[0].bufOffset. */
  bufOffset: number;
}

export interface IbtDiskSubHeader {
  sessionStartDate: number;
  sessionStartTime: number;
  sessionEndTime: number;
  sessionLapCount: number;
  /** Total number of sample records in the file. */
  sessionRecordCount: number;
}

export interface IbtVarHeader {
  type: IbtVarType;
  /** Byte offset of this variable within a sample record. */
  offset: number;
  /** Array length (1 for scalars). */
  count: number;
  name: string;
}

/**
 * Session metadata pulled from the .ibt's YAML string — enough to key the
 * imported lap to the right track/car and to build the distance-bucket grid.
 */
export interface IbtSessionMeta {
  trackId: number;
  trackConfigName: string;
  carPath: string;
  /** Track length in metres, parsed from WeekendInfo.TrackLength. */
  trackLengthM: number;
  /** Human-readable, for the settings display label only. */
  trackDisplayName?: string;
  driverName?: string;
  carScreenName?: string;
}
