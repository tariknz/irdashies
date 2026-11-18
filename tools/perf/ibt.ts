import { promises as fs, constants } from 'node:fs';
import path from 'node:path';

const IBT_HEADER_SIZE = 112;
const DISK_SUBHEADER_SIZE = 32;
const VAR_HEADER_SIZE = 144;
const SUPPORTED_VERSION = 2;
const MAX_NUM_VARS = 8192;
const MAX_BUF_LEN = 1024 * 1024;
const MAX_SESSION_INFO_LEN = 32 * 1024 * 1024;
const VAR_TYPE_BYTES = [1, 1, 4, 4, 4, 8] as const;

export interface IbtRecordingCheck {
  valid: boolean;
  detail: string;
}

const isSafeOffset = (
  value: number,
  size: number
): boolean => Number.isSafeInteger(value) && value >= 0 && value <= size;

const addWithin = (
  offset: number,
  length: number,
  size: number
): boolean =>
  Number.isSafeInteger(offset) &&
  Number.isSafeInteger(length) &&
  length >= 0 &&
  offset >= 0 &&
  offset <= size - length;

const readVarHeaders = async (
  handle: fs.FileHandle,
  offset: number,
  count: number,
  recordLength: number
): Promise<string | undefined> => {
  const buffer = Buffer.alloc(count * VAR_HEADER_SIZE);
  const { bytesRead } = await handle.read(
    buffer,
    0,
    buffer.length,
    offset
  );
  if (bytesRead !== buffer.length) return 'Variable headers are truncated.';
  for (let index = 0; index < count; index++) {
    const base = index * VAR_HEADER_SIZE;
    const type = buffer.readInt32LE(base);
    const variableOffset = buffer.readInt32LE(base + 4);
    const count = buffer.readInt32LE(base + 8);
    if (
      !Number.isInteger(type) ||
      type < 0 ||
      type >= VAR_TYPE_BYTES.length ||
      !Number.isSafeInteger(count) ||
      count <= 0 ||
      variableOffset < 0 ||
      !addWithin(variableOffset, VAR_TYPE_BYTES[type] * count, recordLength)
    )
      return `Variable header ${index + 1} is invalid.`;
  }
  return undefined;
};

export const inspectIbtRecording = async (
  inputPath: string,
  size: number
): Promise<IbtRecordingCheck> => {
  const fail = (detail: string): IbtRecordingCheck => ({ valid: false, detail });
  if (size < IBT_HEADER_SIZE + DISK_SUBHEADER_SIZE)
    return fail('IBT file is smaller than its headers.');

  const handle = await fs.open(inputPath, constants.R_OK);
  try {
    const headerBuffer = Buffer.alloc(IBT_HEADER_SIZE + DISK_SUBHEADER_SIZE);
    const { bytesRead } = await handle.read(
      headerBuffer,
      0,
      headerBuffer.length,
      0
    );
    if (bytesRead !== headerBuffer.length)
      return fail('IBT file is smaller than its headers.');

    const version = headerBuffer.readInt32LE(0);
    const tickRate = headerBuffer.readInt32LE(8);
    const sessionInfoLength = headerBuffer.readInt32LE(16);
    const sessionInfoOffset = headerBuffer.readInt32LE(20);
    const numVars = headerBuffer.readInt32LE(24);
    const varHeaderOffset = headerBuffer.readInt32LE(28);
    const numBuf = headerBuffer.readInt32LE(32);
    const recordLength = headerBuffer.readInt32LE(36);
    const firstRecordOffset = headerBuffer.readInt32LE(52);
    const sessionStartTime = headerBuffer.readDoubleLE(120);
    const sessionEndTime = headerBuffer.readDoubleLE(128);
    const recordCount = headerBuffer.readInt32LE(140);

    if (version !== SUPPORTED_VERSION)
      return fail(`Unsupported IBT header version ${version}.`);
    if (!Number.isSafeInteger(tickRate) || tickRate <= 0 || tickRate > 10_000)
      return fail('IBT tick rate is invalid.');
    if (!Number.isSafeInteger(numVars) || numVars < 1 || numVars > MAX_NUM_VARS)
      return fail('IBT variable count is invalid.');
    if (
      !Number.isSafeInteger(recordLength) ||
      recordLength <= 0 ||
      recordLength > MAX_BUF_LEN
    )
      return fail('IBT sample record length is invalid.');
    if (
      !Number.isSafeInteger(numBuf) ||
      numBuf < 1 ||
      !Number.isSafeInteger(sessionInfoLength) ||
      sessionInfoLength < 0 ||
      sessionInfoLength > MAX_SESSION_INFO_LEN ||
      !isSafeOffset(sessionInfoOffset, size) ||
      !addWithin(sessionInfoOffset, sessionInfoLength, size)
    )
      return fail('IBT session-info region is invalid.');
    if (
      !isSafeOffset(varHeaderOffset, size) ||
      !addWithin(varHeaderOffset, numVars * VAR_HEADER_SIZE, size)
    )
      return fail('IBT variable header region is invalid.');
    if (
      !isSafeOffset(firstRecordOffset, size) ||
      !Number.isSafeInteger(recordCount) ||
      recordCount < 0 ||
      !addWithin(firstRecordOffset, recordCount * recordLength, size)
    )
      return fail('IBT sample region is invalid.');

    const variableError = await readVarHeaders(
      handle,
      varHeaderOffset,
      numVars,
      recordLength
    );
    if (variableError) return fail(variableError);

    const duration = sessionEndTime - sessionStartTime;
    const durationText =
      Number.isFinite(duration) && duration > 0
        ? `, ${(duration / 60).toFixed(1)} min`
        : '';
    return {
      valid: true,
      detail: `Valid IBT recording (${numVars} variables, ${tickRate} Hz, ${recordCount} frames${durationText}).`,
    };
  } finally {
    await handle.close();
  }
};

export const inspectRecording = async (
  inputPath: string
): Promise<IbtRecordingCheck> => {
  await fs.access(inputPath, constants.R_OK);
  const stats = await fs.stat(inputPath);
  if (!stats.isFile() || stats.size === 0)
    return { valid: false, detail: 'Input is not a non-empty regular file.' };
  return inspectIbtRecording(inputPath, stats.size);
};

export const ibtPath = (inputPath: string): boolean =>
  path.extname(inputPath).toLowerCase() === '.ibt';
