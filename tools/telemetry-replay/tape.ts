import { createHash } from 'node:crypto';
import { open, type FileHandle } from 'node:fs/promises';

export const FILE_HEADER_SIZE = 96;
export const SDK_HEADER_SIZE = 112;
export const VARIABLE_HEADER_SIZE = 144;
export const RECORD_HEADER_SIZE = 40;
const MAX_VARIABLES = 4096;
const MAX_PAYLOAD_SIZE = 64 * 1024 * 1024;
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

export type TapeRecordKind =
  'frame' | 'sessionInfo' | 'gap' | 'disconnect' | 'end';

export interface TapeHeader {
  formatVersion: number;
  mappingSize: bigint;
  qpcFrequency: bigint;
  recordCount: bigint;
  schemaChecksum: number;
  sdkVersion: number;
  tickRate: number;
  frameSize: number;
  variableCount: number;
}

export interface TapeVariable {
  type: number;
  offset: number;
  count: number;
  name: string;
  description: string;
  unit: string;
}

export interface TapeRecord {
  kind: TapeRecordKind;
  elapsedTicks: bigint;
  sourceTick: number;
  value: number;
  payload: Buffer;
}

export interface TapeSchema {
  header: TapeHeader;
  variables: ReadonlyMap<string, TapeVariable>;
}

const checksum = (data: Uint8Array): number => {
  let value = FNV_OFFSET;
  for (const byte of data) {
    value ^= byte;
    value = Math.imul(value, FNV_PRIME) >>> 0;
  }
  return value;
};

const readCString = (
  buffer: Buffer,
  offset: number,
  length: number
): string => {
  const end = buffer.indexOf(0, offset);
  return buffer
    .subarray(
      offset,
      end === -1 || end >= offset + length ? offset + length : end
    )
    .toString('utf8');
};

const recordKinds: Record<number, TapeRecordKind> = {
  1: 'frame',
  2: 'sessionInfo',
  3: 'gap',
  4: 'disconnect',
  5: 'end',
};

async function readExact(
  handle: FileHandle,
  buffer: Buffer,
  position: number
): Promise<void> {
  let bytesRead = 0;
  while (bytesRead < buffer.length) {
    const result = await handle.read(
      buffer,
      bytesRead,
      buffer.length - bytesRead,
      position + bytesRead
    );
    if (result.bytesRead === 0) {
      throw new Error('Telemetry tape is truncated');
    }
    bytesRead += result.bytesRead;
  }
}

export class TapeReader {
  readonly schema: TapeSchema;

  private constructor(
    private readonly handle: FileHandle,
    schema: TapeSchema,
    private position: number
  ) {
    this.schema = schema;
  }

  static async open(path: string): Promise<TapeReader> {
    const handle = await open(path, 'r');
    try {
      const fileHeader = Buffer.allocUnsafe(FILE_HEADER_SIZE);
      await readExact(handle, fileHeader, 0);
      if (!fileHeader.subarray(0, 8).equals(Buffer.from('IRDTRCE\0'))) {
        throw new Error('File is not an irDashies telemetry tape');
      }

      const formatVersion = fileHeader.readUInt32LE(8);
      const endianMarker = fileHeader.readUInt32LE(12);
      const fileHeaderSize = fileHeader.readUInt32LE(16);
      const sdkHeaderSize = fileHeader.readUInt32LE(20);
      const variableHeaderSize = fileHeader.readUInt32LE(24);
      const variableCount = fileHeader.readUInt32LE(28);
      if (
        formatVersion !== 1 ||
        endianMarker !== 0x01020304 ||
        fileHeaderSize !== FILE_HEADER_SIZE ||
        sdkHeaderSize !== SDK_HEADER_SIZE ||
        variableHeaderSize !== VARIABLE_HEADER_SIZE ||
        variableCount === 0 ||
        variableCount > MAX_VARIABLES
      ) {
        throw new Error('Unsupported or invalid telemetry tape header');
      }

      const sdkHeader = Buffer.allocUnsafe(SDK_HEADER_SIZE);
      await readExact(handle, sdkHeader, FILE_HEADER_SIZE);
      const variableBytes = Buffer.allocUnsafe(
        variableCount * VARIABLE_HEADER_SIZE
      );
      await readExact(
        handle,
        variableBytes,
        FILE_HEADER_SIZE + SDK_HEADER_SIZE
      );
      const schemaChecksum = fileHeader.readUInt32LE(56);
      if (checksum(variableBytes) !== schemaChecksum) {
        throw new Error('Telemetry tape schema checksum mismatch');
      }

      const frameSize = sdkHeader.readInt32LE(36);
      if (frameSize <= 0 || frameSize > MAX_PAYLOAD_SIZE) {
        throw new Error('Invalid telemetry tape SDK metadata');
      }
      const variables = new Map<string, TapeVariable>();
      for (let index = 0; index < variableCount; index += 1) {
        const base = index * VARIABLE_HEADER_SIZE;
        const variable: TapeVariable = {
          type: variableBytes.readInt32LE(base),
          offset: variableBytes.readInt32LE(base + 4),
          count: variableBytes.readInt32LE(base + 8),
          name: readCString(variableBytes, base + 16, 32),
          description: readCString(variableBytes, base + 48, 64),
          unit: readCString(variableBytes, base + 112, 32),
        };
        const bytesPerValue = [1, 1, 4, 4, 4, 8][variable.type];
        if (
          !bytesPerValue ||
          variable.offset < 0 ||
          variable.count <= 0 ||
          variable.offset + variable.count * bytesPerValue > frameSize ||
          variables.has(variable.name)
        ) {
          throw new Error(`Invalid telemetry variable: ${variable.name}`);
        }
        variables.set(variable.name, variable);
      }

      const header: TapeHeader = {
        formatVersion,
        mappingSize: fileHeader.readBigUInt64LE(32),
        qpcFrequency: fileHeader.readBigUInt64LE(40),
        recordCount: fileHeader.readBigUInt64LE(48),
        schemaChecksum,
        sdkVersion: sdkHeader.readInt32LE(0),
        tickRate: sdkHeader.readInt32LE(8),
        frameSize,
        variableCount,
      };
      if (
        header.mappingSize === 0n ||
        header.qpcFrequency === 0n ||
        header.tickRate <= 0
      ) {
        throw new Error('Invalid telemetry tape SDK metadata');
      }

      return new TapeReader(
        handle,
        { header, variables },
        FILE_HEADER_SIZE + SDK_HEADER_SIZE + variableBytes.length
      );
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async readRecord(): Promise<TapeRecord | undefined> {
    const header = Buffer.allocUnsafe(RECORD_HEADER_SIZE);
    const result = await this.handle.read(
      header,
      0,
      header.length,
      this.position
    );
    if (result.bytesRead === 0) return undefined;
    if (result.bytesRead !== header.length) {
      throw new Error('Telemetry tape is truncated');
    }
    this.position += header.length;

    const kind = recordKinds[header.readUInt32LE(0)];
    const headerSize = header.readUInt32LE(4);
    const payloadSize = header.readUInt32LE(8);
    if (
      !kind ||
      headerSize !== RECORD_HEADER_SIZE ||
      payloadSize > MAX_PAYLOAD_SIZE
    ) {
      throw new Error('Invalid telemetry tape record header');
    }
    const payload = Buffer.allocUnsafe(payloadSize);
    if (payloadSize > 0) await readExact(this.handle, payload, this.position);
    this.position += payloadSize;
    if (checksum(payload) !== header.readUInt32LE(32)) {
      throw new Error('Telemetry tape record checksum mismatch');
    }
    if (kind === 'frame' && payloadSize !== this.schema.header.frameSize) {
      throw new Error('Telemetry frame size does not match the SDK schema');
    }
    return {
      kind,
      elapsedTicks: header.readBigUInt64LE(16),
      sourceTick: header.readInt32LE(24),
      value: header.readInt32LE(28),
      payload,
    };
  }

  async close(): Promise<void> {
    await this.handle.close();
  }
}

export async function sha256File(path: string): Promise<string> {
  const handle = await open(path, 'r');
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position
      );
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return hash.digest('hex').toUpperCase();
  } finally {
    await handle.close();
  }
}
