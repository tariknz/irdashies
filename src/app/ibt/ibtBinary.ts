/**
 * Pure decoders for the .ibt binary structs. No I/O — every function takes a
 * Buffer already read from disk, so they are trivially unit-testable against
 * synthetic bytes (see ibtBinary.spec.ts).
 */
import {
  IBT_DISK_SUBHEADER_SIZE,
  IBT_HEADER_SIZE,
  IBT_VAR_HEADER_SIZE,
  IBT_VAR_TYPE_BYTES,
  IbtVarType,
  type IbtDiskSubHeader,
  type IbtHeader,
  type IbtVarHeader,
} from './ibtTypes';
import { IbtImportError } from './ibtErrors';

/** Read a fixed-length C string, stopping at the first NUL. */
const readCString = (buf: Buffer, start: number, maxLen: number): string => {
  let end = start;
  const limit = Math.min(start + maxLen, buf.length);
  while (end < limit && buf[end] !== 0) end++;
  return buf.toString('latin1', start, end);
};

/**
 * Parse the 112-byte irsdk_header. Field offsets are from the C struct; the
 * first varBuf (at offset 48) carries the sample-buffer start for a disk file.
 */
export const parseHeader = (buf: Buffer): IbtHeader => {
  if (buf.length < IBT_HEADER_SIZE) {
    throw new IbtImportError('truncated', 'File is smaller than the header');
  }
  return {
    ver: buf.readInt32LE(0),
    status: buf.readInt32LE(4),
    tickRate: buf.readInt32LE(8),
    sessionInfoUpdate: buf.readInt32LE(12),
    sessionInfoLen: buf.readInt32LE(16),
    sessionInfoOffset: buf.readInt32LE(20),
    numVars: buf.readInt32LE(24),
    varHeaderOffset: buf.readInt32LE(28),
    numBuf: buf.readInt32LE(32),
    bufLen: buf.readInt32LE(36),
    // varBuf[0] starts at offset 48: { int tickCount; int bufOffset; ... }
    bufOffset: buf.readInt32LE(52),
  };
};

/** Parse the 32-byte irsdk_diskSubHeader that follows the header. */
export const parseDiskSubHeader = (buf: Buffer): IbtDiskSubHeader => {
  const base = IBT_HEADER_SIZE;
  if (buf.length < base + IBT_DISK_SUBHEADER_SIZE) {
    throw new IbtImportError(
      'truncated',
      'File is missing the disk sub-header'
    );
  }
  return {
    // time_t is 8 bytes on the 64-bit sim build; only the low 32 bits matter
    // for our purposes and JS numbers hold it fine via a double read cast.
    sessionStartDate: Number(buf.readBigInt64LE(base)),
    sessionStartTime: buf.readDoubleLE(base + 8),
    sessionEndTime: buf.readDoubleLE(base + 16),
    sessionLapCount: buf.readInt32LE(base + 24),
    sessionRecordCount: buf.readInt32LE(base + 28),
  };
};

/**
 * Parse the varHeader array. `buf` must contain the region starting at
 * header.varHeaderOffset and covering numVars * 144 bytes.
 */
export const parseVarHeaders = (
  buf: Buffer,
  numVars: number
): IbtVarHeader[] => {
  const headers: IbtVarHeader[] = [];
  for (let i = 0; i < numVars; i++) {
    const base = i * IBT_VAR_HEADER_SIZE;
    if (base + IBT_VAR_HEADER_SIZE > buf.length) {
      throw new IbtImportError(
        'truncated',
        'Variable header array is truncated'
      );
    }
    headers.push({
      type: buf.readInt32LE(base) as IbtVarType,
      offset: buf.readInt32LE(base + 4),
      count: buf.readInt32LE(base + 8),
      // countAsTime bool @12 + pad @13..15; name char[32] @16.
      name: readCString(buf, base + 16, 32),
    });
  }
  return headers;
};

/**
 * Read a single scalar value from a sample record. `record` is a Buffer holding
 * one row (bufLen bytes); the value sits at varHeader.offset. Booleans and
 * chars come back as numbers so every channel is a uniform `number`.
 */
export const readVarValue = (record: Buffer, header: IbtVarHeader): number => {
  const at = header.offset;
  switch (header.type) {
    case IbtVarType.Char:
      return record.readUInt8(at);
    case IbtVarType.Bool:
      return record.readUInt8(at) !== 0 ? 1 : 0;
    case IbtVarType.Int:
    case IbtVarType.BitField:
      return record.readInt32LE(at);
    case IbtVarType.Float:
      return record.readFloatLE(at);
    case IbtVarType.Double:
      return record.readDoubleLE(at);
    default:
      return Number.NaN;
  }
};

/** Byte width of one entry of the given var type. */
export const varTypeBytes = (type: IbtVarType): number =>
  IBT_VAR_TYPE_BYTES[type] ?? 0;
