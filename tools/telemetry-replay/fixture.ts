import {
  FILE_HEADER_SIZE,
  RECORD_HEADER_SIZE,
  SDK_HEADER_SIZE,
  VARIABLE_HEADER_SIZE,
} from './tape';

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const SESSION_PAYLOAD = Buffer.from('---\nSessionInfo: test\n...\n');

export const SYNTHETIC_SECOND_FRAME_PAYLOAD_OFFSET =
  FILE_HEADER_SIZE +
  SDK_HEADER_SIZE +
  2 * VARIABLE_HEADER_SIZE +
  RECORD_HEADER_SIZE +
  SESSION_PAYLOAD.length +
  RECORD_HEADER_SIZE +
  12 +
  RECORD_HEADER_SIZE;

const checksum = (data: Uint8Array): number => {
  let value = FNV_OFFSET;
  for (const byte of data) {
    value ^= byte;
    value = Math.imul(value, FNV_PRIME) >>> 0;
  }
  return value;
};

const variable = (type: number, offset: number, name: string): Buffer => {
  const result = Buffer.alloc(VARIABLE_HEADER_SIZE);
  result.writeInt32LE(type, 0);
  result.writeInt32LE(offset, 4);
  result.writeInt32LE(1, 8);
  result.write(name, 16, 31, 'ascii');
  return result;
};

const record = (
  kind: number,
  elapsedTicks: bigint,
  sourceTick: number,
  value: number,
  payload: Uint8Array = Buffer.alloc(0)
): Buffer => {
  const header = Buffer.alloc(RECORD_HEADER_SIZE);
  header.writeUInt32LE(kind, 0);
  header.writeUInt32LE(RECORD_HEADER_SIZE, 4);
  header.writeUInt32LE(payload.length, 8);
  header.writeBigUInt64LE(elapsedTicks, 16);
  header.writeInt32LE(sourceTick, 24);
  header.writeInt32LE(value, 28);
  header.writeUInt32LE(checksum(payload), 32);
  return Buffer.concat([header, Buffer.from(payload)]);
};

export function createSyntheticTape(): Buffer {
  const variables = Buffer.concat([
    variable(5, 0, 'SessionTime'),
    variable(4, 8, 'FuelLevel'),
  ]);
  const sessionInfoOffset = SDK_HEADER_SIZE + variables.length;
  const sessionInfoLength = 1024;
  const frameBufferOffset = sessionInfoOffset + sessionInfoLength;
  const mappingSize = frameBufferOffset + 12;
  const sdkHeader = Buffer.alloc(SDK_HEADER_SIZE);
  sdkHeader.writeInt32LE(2, 0);
  sdkHeader.writeInt32LE(1, 4);
  sdkHeader.writeInt32LE(60, 8);
  sdkHeader.writeInt32LE(1, 12);
  sdkHeader.writeInt32LE(sessionInfoLength, 16);
  sdkHeader.writeInt32LE(sessionInfoOffset, 20);
  sdkHeader.writeInt32LE(2, 24);
  sdkHeader.writeInt32LE(SDK_HEADER_SIZE, 28);
  sdkHeader.writeInt32LE(1, 32);
  sdkHeader.writeInt32LE(12, 36);
  sdkHeader.writeInt32LE(-1, 48);
  sdkHeader.writeInt32LE(frameBufferOffset, 52);

  const frame = (sessionTime: number, fuelLevel: number): Buffer => {
    const payload = Buffer.alloc(12);
    payload.writeDoubleLE(sessionTime, 0);
    payload.writeFloatLE(fuelLevel, 8);
    return payload;
  };
  const records = [
    record(2, 0n, -1, 1, SESSION_PAYLOAD),
    record(1, 0n, 10, 0, frame(1, 20)),
    record(1, 1n, 11, 0, frame(1.5, 19.9)),
    record(5, 2n, 11, 0),
  ];
  const fileHeader = Buffer.alloc(FILE_HEADER_SIZE);
  fileHeader.write('IRDTRCE\0', 0, 'ascii');
  fileHeader.writeUInt32LE(1, 8);
  fileHeader.writeUInt32LE(0x01020304, 12);
  fileHeader.writeUInt32LE(FILE_HEADER_SIZE, 16);
  fileHeader.writeUInt32LE(SDK_HEADER_SIZE, 20);
  fileHeader.writeUInt32LE(VARIABLE_HEADER_SIZE, 24);
  fileHeader.writeUInt32LE(2, 28);
  fileHeader.writeBigUInt64LE(BigInt(mappingSize), 32);
  fileHeader.writeBigUInt64LE(2n, 40);
  fileHeader.writeBigUInt64LE(BigInt(records.length), 48);
  fileHeader.writeUInt32LE(checksum(variables), 56);
  return Buffer.concat([fileHeader, sdkHeader, variables, ...records]);
}
