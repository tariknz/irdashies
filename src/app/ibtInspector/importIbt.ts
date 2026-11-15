import { open, rm, type FileHandle } from 'node:fs/promises';

const SDK_SIZE = 112;
const VAR_SIZE = 144;
const MAX_PAYLOAD = 64 * 1024 * 1024;

export interface ReplayInputInfo {
  format: 'ibt' | 'irdt';
  frames: number;
  durationSeconds: number;
  tickRate: number;
  variables: string[];
  warnings: string[];
}

async function readExact(file: FileHandle, length: number, offset: number) {
  const bytes = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const result = await file.read(bytes, read, length - read, offset + read);
    if (!result.bytesRead) throw new Error('Truncated IBT file');
    read += result.bytesRead;
  }
  return bytes;
}

export function tapeChecksum(bytes: Uint8Array): number {
  let value = 2166136261;
  for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0;
  return value;
}

/** Stream IBT frames into the existing tape transport; memory stays bounded. */
export async function importIbt(
  input: string,
  output: string
): Promise<ReplayInputInfo> {
  const source = await open(input, 'r');
  let destination: FileHandle | undefined;
  let created = false;
  try {
    const size = (await source.stat()).size;
    const original = await readExact(source, SDK_SIZE + 32, 0);
    const version = original.readInt32LE(0);
    const tickRate = original.readInt32LE(8);
    const sessionLength = original.readInt32LE(16);
    const sessionOffset = original.readInt32LE(20);
    const count = original.readInt32LE(24);
    const variableOffset = original.readInt32LE(28);
    const frameSize = original.readInt32LE(36);
    const frameOffset = original.readInt32LE(52);
    const frames = original.readInt32LE(SDK_SIZE + 28);
    const inFile = (offset: number, length: number) =>
      Number.isSafeInteger(offset + length) &&
      offset >= SDK_SIZE + 32 &&
      length > 0 &&
      offset + length <= size;
    if (
      version < 1 ||
      tickRate < 1 ||
      tickRate > 10000 ||
      count < 1 ||
      count > 4096 ||
      frameSize < 1 ||
      frameSize > MAX_PAYLOAD ||
      frames < 1 ||
      sessionLength > MAX_PAYLOAD ||
      !inFile(sessionOffset, sessionLength) ||
      !inFile(variableOffset, count * VAR_SIZE) ||
      !inFile(frameOffset, frames * frameSize)
    ) {
      throw new Error('Invalid, unfinished or truncated IBT header');
    }
    const ranges = [
      [0, SDK_SIZE + 32],
      [sessionOffset, sessionOffset + sessionLength],
      [variableOffset, variableOffset + count * VAR_SIZE],
      [frameOffset, frameOffset + frames * frameSize],
    ].sort((a, b) => a[0] - b[0]);
    if (ranges.some((r, i) => i > 0 && r[0] < ranges[i - 1][1])) {
      throw new Error('Overlapping IBT data regions');
    }
    const variables = await readExact(source, count * VAR_SIZE, variableOffset);
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const base = i * VAR_SIZE;
      const type = variables.readInt32LE(base);
      const offset = variables.readInt32LE(base + 4);
      const length = variables.readInt32LE(base + 8);
      const name = variables
        .subarray(base + 16, base + 48)
        .toString('ascii')
        .split('\0')[0];
      const width = [1, 1, 4, 4, 4, 8][type];
      if (
        !width ||
        offset < 0 ||
        length < 1 ||
        offset + length * width > frameSize ||
        !name ||
        names.includes(name)
      )
        throw new Error('Invalid IBT variable descriptor');
      names.push(name);
    }
    const session = await readExact(source, sessionLength, sessionOffset);
    // IBT disk offsets are not shared-memory offsets: construct a compact,
    // non-overlapping SDK layout for the existing native tape validator.
    const sdk = Buffer.from(original.subarray(0, SDK_SIZE));
    const sessionAt = SDK_SIZE + variables.length;
    const frameAt = sessionAt + session.length;
    sdk.writeInt32LE(1, 4);
    sdk.writeInt32LE(1, 12);
    sdk.writeInt32LE(session.length, 16);
    sdk.writeInt32LE(sessionAt, 20);
    sdk.writeInt32LE(SDK_SIZE, 28);
    sdk.writeInt32LE(1, 32);
    sdk.fill(0, 48);
    sdk.writeInt32LE(frameAt, 52);
    const header = Buffer.alloc(96);
    header.write('IRDTRCE\0', 0, 'ascii');
    header.writeUInt32LE(1, 8);
    header.writeUInt32LE(0x01020304, 12);
    header.writeUInt32LE(96, 16);
    header.writeUInt32LE(SDK_SIZE, 20);
    header.writeUInt32LE(VAR_SIZE, 24);
    header.writeUInt32LE(count, 28);
    header.writeBigUInt64LE(BigInt(frameAt + frameSize), 32);
    header.writeBigUInt64LE(1_000_000n, 40);
    header.writeBigUInt64LE(BigInt(frames + 2), 48);
    header.writeUInt32LE(tapeChecksum(variables), 56);
    destination = await open(output, 'wx');
    created = true;
    const destinationFile = destination;
    const write = async (bytes: Buffer) => {
      let offset = 0;
      while (offset < bytes.length) {
        const result = await destinationFile.write(
          bytes,
          offset,
          bytes.length - offset
        );
        if (!result.bytesWritten)
          throw new Error('Could not write converted tape');
        offset += result.bytesWritten;
      }
    };
    const record = async (
      kind: number,
      index: number,
      value: number,
      payload: Buffer
    ) => {
      const recordHeader = Buffer.alloc(40);
      recordHeader.writeUInt32LE(kind, 0);
      recordHeader.writeUInt32LE(40, 4);
      recordHeader.writeUInt32LE(payload.length, 8);
      recordHeader.writeBigUInt64LE(
        BigInt(Math.round((index * 1_000_000) / tickRate)),
        16
      );
      recordHeader.writeInt32LE(index + 1, 24);
      recordHeader.writeInt32LE(value, 28);
      recordHeader.writeUInt32LE(tapeChecksum(payload), 32);
      await write(recordHeader);
      await write(payload);
    };
    await write(header);
    await write(sdk);
    await write(variables);
    await record(2, 0, 1, session);
    // Reuse bounded chunks, rather than one read syscall per telemetry frame.
    const chunkFrames = Math.max(1, Math.floor((1024 * 1024) / frameSize));
    for (let first = 0; first < frames; first += chunkFrames) {
      const number = Math.min(chunkFrames, frames - first);
      const chunk = await readExact(
        source,
        number * frameSize,
        frameOffset + first * frameSize
      );
      for (let j = 0; j < number; j++)
        await record(
          1,
          first + j,
          0,
          chunk.subarray(j * frameSize, (j + 1) * frameSize)
        );
    }
    await record(5, frames - 1, 0, Buffer.alloc(0));
    return {
      format: 'ibt',
      frames,
      durationSeconds: (frames - 1) / tickRate,
      tickRate,
      variables: names,
      warnings: [
        'IBT transport timing uses its declared tick rate; raw telemetry values are preserved.',
        'IBT session info is one snapshot, not a recording of session/lifecycle events.',
        ...(!names.includes('CarIdxLapDistPct')
          ? [
              'No CarIdxLapDistPct: traffic-dependent widgets cannot be fully exercised.',
            ]
          : []),
      ],
    };
  } catch (error) {
    await destination?.close();
    destination = undefined;
    if (created) await rm(output, { force: true });
    throw error;
  } finally {
    await source.close();
    await destination?.close();
  }
}
