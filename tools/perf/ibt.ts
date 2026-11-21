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

const isSafeOffset = (value: number, size: number): boolean =>
  Number.isSafeInteger(value) && value >= 0 && value <= size;

const addWithin = (offset: number, length: number, size: number): boolean =>
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
): Promise<Buffer | string> => {
  const buffer = Buffer.alloc(count * VAR_HEADER_SIZE);
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
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
  return buffer;
};

type IbtInspection =
  | { valid: false; detail: string }
  | { valid: true; detail: string; headerBuffer: Buffer; variables: Buffer };

const readIbt = async (
  handle: fs.FileHandle,
  size: number
): Promise<IbtInspection> => {
  const fail = (detail: string) => ({ valid: false as const, detail });
  if (size < IBT_HEADER_SIZE + DISK_SUBHEADER_SIZE)
    return fail('IBT file is smaller than its headers.');
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

  const variables = await readVarHeaders(
    handle,
    varHeaderOffset,
    numVars,
    recordLength
  );
  if (typeof variables === 'string') return fail(variables);

  const duration = sessionEndTime - sessionStartTime;
  const durationText =
    Number.isFinite(duration) && duration > 0
      ? `, ${(duration / 60).toFixed(1)} min`
      : '';
  return {
    valid: true,
    headerBuffer,
    variables,
    detail: `Valid IBT recording (${numVars} variables, ${tickRate} Hz, ${recordCount} frames${durationText}).`,
  };
};

export const inspectIbtRecording = async (
  inputPath: string,
  size: number
): Promise<IbtRecordingCheck> => {
  const handle = await fs.open(inputPath, constants.R_OK);
  try {
    const { valid, detail } = await readIbt(handle, size);
    return { valid, detail };
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

const IRDT_HEADER_SIZE = 96;
const IRDT_RECORD_HEADER_SIZE = 40;
const IRDT_MAX_VARIABLES = 4096;
const IRDT_REPLAY_BUFFERS = 3;

function tapeChecksum(buffer: Buffer): number {
  let checksum = 2166136261;
  for (const byte of buffer) checksum = Math.imul(checksum ^ byte, 16777619);
  return checksum >>> 0;
}

export async function convertIbtToTape(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const input = await fs.open(inputPath, 'r');
  try {
    const check = await readIbt(input, (await input.stat()).size);
    if (!check.valid) throw new Error(check.detail);
    const read = async (length: number, position: number): Promise<Buffer> => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await input.read(buffer, 0, length, position);
      if (bytesRead !== length) throw new Error('IBT input was truncated.');
      return buffer;
    };
    const { headerBuffer: headers, variables } = check;
    const sdkHeader = headers.subarray(0, IBT_HEADER_SIZE);
    const tickRate = sdkHeader.readInt32LE(8);
    const sessionLength = sdkHeader.readInt32LE(16);
    const variableCount = sdkHeader.readInt32LE(24);
    const frameLength = sdkHeader.readInt32LE(36);
    const frameOffset = sdkHeader.readInt32LE(52);
    const frameCount = headers.readInt32LE(140);
    if (frameCount === 0 || variableCount > IRDT_MAX_VARIABLES)
      throw new Error(
        'IBT recording has no frames or too many variables for IRDT.'
      );

    const session = await read(sessionLength, sdkHeader.readInt32LE(20));
    const sessionOffset = IBT_HEADER_SIZE + variables.length;
    const bufferOffset = Math.ceil((sessionOffset + session.length) / 8) * 8;
    sdkHeader.writeInt32LE(1, 4);
    sdkHeader.writeInt32LE(1, 12);
    sdkHeader.writeInt32LE(sessionOffset, 20);
    sdkHeader.writeInt32LE(IBT_HEADER_SIZE, 28);
    sdkHeader.writeInt32LE(IRDT_REPLAY_BUFFERS, 32);
    sdkHeader.fill(0, 48);
    for (let index = 0; index < IRDT_REPLAY_BUFFERS; index++)
      sdkHeader.writeInt32LE(
        bufferOffset + index * frameLength,
        52 + index * 16
      );

    const tapeHeader = Buffer.alloc(IRDT_HEADER_SIZE);
    tapeHeader.write('IRDTRCE');
    const layout = [
      1,
      0x01020304,
      IRDT_HEADER_SIZE,
      IBT_HEADER_SIZE,
      VAR_HEADER_SIZE,
      variableCount,
    ];
    layout.forEach((value, index) =>
      tapeHeader.writeUInt32LE(value, 8 + 4 * index)
    );
    tapeHeader.writeBigUInt64LE(
      BigInt(bufferOffset + IRDT_REPLAY_BUFFERS * frameLength),
      32
    );
    tapeHeader.writeBigUInt64LE(BigInt(tickRate), 40);
    tapeHeader.writeBigUInt64LE(
      BigInt(frameCount + (session.length > 0 ? 2 : 1)),
      48
    );
    tapeHeader.writeUInt32LE(tapeChecksum(variables), 56);

    const output = await fs.open(outputPath, 'wx');
    try {
      await output.writeFile(Buffer.concat([tapeHeader, sdkHeader, variables]));
      const record = async (
        kind: number,
        ticks: number,
        sourceTick: number,
        value: number,
        payload: Buffer
      ): Promise<void> => {
        const header = Buffer.alloc(IRDT_RECORD_HEADER_SIZE);
        header.writeUInt32LE(kind, 0);
        header.writeUInt32LE(IRDT_RECORD_HEADER_SIZE, 4);
        header.writeUInt32LE(payload.length, 8);
        header.writeBigUInt64LE(BigInt(ticks), 16);
        header.writeInt32LE(sourceTick, 24);
        header.writeInt32LE(value, 28);
        header.writeUInt32LE(tapeChecksum(payload), 32);
        await output.writeFile(Buffer.concat([header, payload]));
      };
      if (session.length > 0) await record(2, 0, -1, 1, session);
      for (let index = 0; index < frameCount; index++) {
        const frame = await read(
          frameLength,
          frameOffset + index * frameLength
        );
        await record(1, index, index, index % IRDT_REPLAY_BUFFERS, frame);
      }
      await record(5, frameCount, frameCount - 1, 0, Buffer.alloc(0));
    } finally {
      await output.close();
    }
  } finally {
    await input.close();
  }
}
