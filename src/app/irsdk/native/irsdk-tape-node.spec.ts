import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { INativeSDK } from './index';

const FILE_HEADER_SIZE = 96;
const SDK_HEADER_SIZE = 112;
const VARIABLE_HEADER_SIZE = 144;
const RECORD_HEADER_SIZE = 40;
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

function checksum(data: Uint8Array): number {
  let value = FNV_OFFSET;
  for (const byte of data) {
    value ^= byte;
    value = Math.imul(value, FNV_PRIME) >>> 0;
  }
  return value;
}

function writeCString(
  target: Buffer,
  offset: number,
  length: number,
  value: string
): void {
  target.write(value, offset, length - 1, 'ascii');
}

interface VariableFixture {
  type: number;
  offset: number;
  count: number;
  name: string;
  description: string;
  unit: string;
}

function createVariableHeader(variable: VariableFixture): Buffer {
  const header = Buffer.alloc(VARIABLE_HEADER_SIZE);
  header.writeInt32LE(variable.type, 0);
  header.writeInt32LE(variable.offset, 4);
  header.writeInt32LE(variable.count, 8);
  writeCString(header, 16, 32, variable.name);
  writeCString(header, 48, 64, variable.description);
  writeCString(header, 112, 32, variable.unit);
  return header;
}

function createRecord(
  kind: number,
  elapsedTicks: bigint,
  sourceTick: number,
  value: number,
  payload: Uint8Array = Buffer.alloc(0)
): Buffer {
  const header = Buffer.alloc(RECORD_HEADER_SIZE);
  header.writeUInt32LE(kind, 0);
  header.writeUInt32LE(RECORD_HEADER_SIZE, 4);
  header.writeUInt32LE(payload.length, 8);
  header.writeBigUInt64LE(elapsedTicks, 16);
  header.writeInt32LE(sourceTick, 24);
  header.writeInt32LE(value, 28);
  header.writeUInt32LE(checksum(payload), 32);
  return Buffer.concat([header, payload]);
}

function createFrame(index: number): Buffer {
  const frame = Buffer.alloc(36);
  frame.writeDoubleLE(10 + index / 60, 0);
  frame.writeInt32LE(100 + index, 8);
  frame.writeInt8(index === 0 ? 0 : 1, 12);
  frame.writeUInt32LE(0x80000000, 16);
  frame.writeFloatLE(50 + index, 20);
  frame.writeFloatLE(0.1 + index / 100, 24);
  frame.writeFloatLE(0.2 + index / 100, 28);
  frame.writeFloatLE(0.3 + index / 100, 32);
  return frame;
}

interface TapeFixtureOptions {
  includeEndRecord?: boolean;
  qpcFrequency?: bigint;
}

function createTapeFixture({
  includeEndRecord = true,
  qpcFrequency = 60n,
}: TapeFixtureOptions = {}): Buffer {
  const variables = [
    createVariableHeader({
      type: 5,
      offset: 0,
      count: 1,
      name: 'SessionTime',
      description: 'Seconds since session start',
      unit: 's',
    }),
    createVariableHeader({
      type: 2,
      offset: 8,
      count: 1,
      name: 'SessionTick',
      description: 'Current update number',
      unit: '',
    }),
    createVariableHeader({
      type: 1,
      offset: 12,
      count: 1,
      name: 'IsOnTrack',
      description: 'Player is on track',
      unit: '',
    }),
    createVariableHeader({
      type: 3,
      offset: 16,
      count: 1,
      name: 'SessionFlags',
      description: 'Session flags',
      unit: 'irsdk_Flags',
    }),
    createVariableHeader({
      type: 4,
      offset: 20,
      count: 1,
      name: 'Speed',
      description: 'Player speed',
      unit: 'm/s',
    }),
    createVariableHeader({
      type: 4,
      offset: 24,
      count: 3,
      name: 'CarIdxLapDistPct',
      description: 'Car positions',
      unit: '%',
    }),
  ];
  const variableBytes = Buffer.concat(variables);
  const sessionOffset = SDK_HEADER_SIZE + variableBytes.length;
  const sessionCapacity = 1024;
  const firstBufferOffset = sessionOffset + sessionCapacity;
  const mappingSize = firstBufferOffset + 3 * 36;

  const sdkHeader = Buffer.alloc(SDK_HEADER_SIZE);
  sdkHeader.writeInt32LE(2, 0);
  sdkHeader.writeInt32LE(1, 4);
  sdkHeader.writeInt32LE(60, 8);
  sdkHeader.writeInt32LE(1, 12);
  sdkHeader.writeInt32LE(sessionCapacity, 16);
  sdkHeader.writeInt32LE(sessionOffset, 20);
  sdkHeader.writeInt32LE(variables.length, 24);
  sdkHeader.writeInt32LE(SDK_HEADER_SIZE, 28);
  sdkHeader.writeInt32LE(3, 32);
  sdkHeader.writeInt32LE(36, 36);
  for (let index = 0; index < 3; index++) {
    const bufferHeaderOffset = 48 + index * 16;
    sdkHeader.writeInt32LE(-1, bufferHeaderOffset);
    sdkHeader.writeInt32LE(
      firstBufferOffset + index * 36,
      bufferHeaderOffset + 4
    );
  }

  const session = Buffer.from(
    '---\nWeekendInfo:\n TrackName: Replay Test Track\n...\n',
    'ascii'
  );
  const records = [
    createRecord(2, 0n, -1, 1, session),
    createRecord(1, 0n, 100, 0, createFrame(0)),
    createRecord(1, 1n, 101, 0, createFrame(1)),
    createRecord(1, 2n, 102, 0, createFrame(2)),
  ];
  if (includeEndRecord) {
    records.push(createRecord(5, 3n, 102, 0));
  }

  const fileHeader = Buffer.alloc(FILE_HEADER_SIZE);
  fileHeader.write('IRDTRCE\0', 0, 'ascii');
  fileHeader.writeUInt32LE(1, 8);
  fileHeader.writeUInt32LE(0x01020304, 12);
  fileHeader.writeUInt32LE(FILE_HEADER_SIZE, 16);
  fileHeader.writeUInt32LE(SDK_HEADER_SIZE, 20);
  fileHeader.writeUInt32LE(VARIABLE_HEADER_SIZE, 24);
  fileHeader.writeUInt32LE(variables.length, 28);
  fileHeader.writeBigUInt64LE(BigInt(mappingSize), 32);
  fileHeader.writeBigUInt64LE(qpcFrequency, 40);
  fileHeader.writeBigUInt64LE(BigInt(records.length), 48);
  fileHeader.writeUInt32LE(checksum(variableBytes), 56);

  return Buffer.concat([fileHeader, sdkHeader, variableBytes, ...records]);
}

const doubleValue = (value: unknown): number =>
  new Float64Array(value as ArrayBuffer)[0];
const floatValue = (value: unknown): number =>
  new Float32Array(value as ArrayBuffer)[0];
const intValue = (value: unknown): number =>
  new Int32Array(value as ArrayBuffer)[0];
const addonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'build',
  'Release',
  'irsdk_tape_node.node'
);

function loadAddon(): { iRacingSdkNode: new () => INativeSDK } {
  const require = createRequire(import.meta.url);
  return require(addonPath) as { iRacingSdkNode: new () => INativeSDK };
}

describe('tape-backed native SDK', () => {
  let temporaryDirectory: string;
  let tapePath: string;

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'irdashies-tape-node-')
    );
    tapePath = path.join(temporaryDirectory, 'synthetic.irdt');
  });

  beforeEach(() => {
    delete process.env.IRDASHIES_TELEMETRY_REPLAY_SPEED;
  });

  afterEach(() => {
    delete process.env.IRDASHIES_TELEMETRY_REPLAY;
    delete process.env.IRDASHIES_TELEMETRY_REPLAY_LOOP;
    delete process.env.IRDASHIES_TELEMETRY_REPLAY_SPEED;
  });

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('replays raw frames and embedded session YAML through INativeSDK', async () => {
    await writeFile(tapePath, createTapeFixture());

    process.env.IRDASHIES_TELEMETRY_REPLAY = tapePath;
    process.env.IRDASHIES_TELEMETRY_REPLAY_LOOP = '1';

    const addon = loadAddon();
    const sdk = new addon.iRacingSdkNode();

    try {
      expect(sdk.startSDK()).toBe(true);

      expect(sdk.waitForData(20)).toBe(true);
      let telemetry = sdk.getTelemetryData();
      expect(doubleValue(telemetry.SessionTime.value)).toBeCloseTo(10, 8);
      expect(intValue(telemetry.SessionTick.value)).toBe(100);
      expect(sdk.getSessionData()).toContain('TrackName: Replay Test Track');

      expect(sdk.waitForData(20)).toBe(true);
      telemetry = sdk.getTelemetryData();
      const nextSpeed = floatValue(telemetry.Speed.value);
      expect(nextSpeed).toBeGreaterThanOrEqual(51);
      expect(nextSpeed).toBeLessThanOrEqual(52);

      // A busy runner can make both remaining frames due before waitForData
      // returns. The replay source correctly catches up to the newest frame.
      if (nextSpeed < 52) {
        expect(sdk.waitForData(20)).toBe(true);
        telemetry = sdk.getTelemetryData();
        expect(floatValue(telemetry.Speed.value)).toBeCloseTo(52, 5);
      }

      expect(sdk.waitForData(20)).toBe(false);
      expect(sdk.isRunning()).toBe(false);
      expect(sdk.waitForData(20)).toBe(true);
      expect(floatValue(sdk.getTelemetryData().Speed.value)).toBeCloseTo(50, 5);
    } finally {
      sdk.stopSDK();
    }
  });

  it('reports a disconnect before looping at physical end-of-file', async () => {
    await writeFile(tapePath, createTapeFixture({ includeEndRecord: false }));

    process.env.IRDASHIES_TELEMETRY_REPLAY = tapePath;
    process.env.IRDASHIES_TELEMETRY_REPLAY_LOOP = '1';

    const addon = loadAddon();
    const sdk = new addon.iRacingSdkNode();

    try {
      expect(sdk.startSDK()).toBe(true);

      let speed = 0;
      while (speed < 52) {
        expect(sdk.waitForData(20)).toBe(true);
        speed = floatValue(sdk.getTelemetryData().Speed.value);
      }

      expect(speed).toBeCloseTo(52, 5);
      expect(sdk.waitForData(20)).toBe(false);
      expect(sdk.isRunning()).toBe(false);
      expect(sdk.waitForData(20)).toBe(true);
      expect(floatValue(sdk.getTelemetryData().Speed.value)).toBeCloseTo(50, 5);
    } finally {
      sdk.stopSDK();
    }
  });

  it('returns when the requested wait timeout expires', async () => {
    await writeFile(tapePath, createTapeFixture({ qpcFrequency: 1n }));

    process.env.IRDASHIES_TELEMETRY_REPLAY = tapePath;

    const addon = loadAddon();
    const sdk = new addon.iRacingSdkNode();

    try {
      expect(sdk.startSDK()).toBe(true);
      expect(sdk.waitForData(20)).toBe(true);
      expect(floatValue(sdk.getTelemetryData().Speed.value)).toBeCloseTo(50, 5);
      expect(sdk.waitForData(5)).toBe(false);
      expect(sdk.isRunning()).toBe(true);
    } finally {
      sdk.stopSDK();
    }
  });
});
