import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { NativeSDK } from './index';

const execFileAsync = promisify(execFile);

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

function createFrame(index: number, length = 36): Buffer {
  const frame = Buffer.alloc(length);
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
  includeSessionUpdate?: boolean;
  includeEndRecord?: boolean;
  qpcFrequency?: bigint;
  frameLength?: number;
  transformVariables?: (variables: Buffer[]) => void;
}

function createTapeFixture({
  includeSessionUpdate = false,
  includeEndRecord = true,
  qpcFrequency = 60n,
  frameLength = 36,
  transformVariables,
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
  transformVariables?.(variables);
  const variableBytes = Buffer.concat(variables);
  const sessionOffset = SDK_HEADER_SIZE + variableBytes.length;
  const sessionCapacity = 1024;
  const firstBufferOffset = sessionOffset + sessionCapacity;
  const mappingSize = firstBufferOffset + 3 * frameLength;

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
  sdkHeader.writeInt32LE(frameLength, 36);
  for (let index = 0; index < 3; index++) {
    const bufferHeaderOffset = 48 + index * 16;
    sdkHeader.writeInt32LE(-1, bufferHeaderOffset);
    sdkHeader.writeInt32LE(
      firstBufferOffset + index * frameLength,
      bufferHeaderOffset + 4
    );
  }

  const session = Buffer.from(
    '---\nWeekendInfo:\n TrackName: Replay Test Track\n...\n',
    'ascii'
  );
  const records = [
    createRecord(2, 0n, -1, 1, session),
    createRecord(1, 0n, 100, 0, createFrame(0, frameLength)),
    createRecord(1, 1n, 101, 0, createFrame(1, frameLength)),
    createRecord(1, 2n, 102, 0, createFrame(2, frameLength)),
  ];
  if (includeSessionUpdate) {
    records.splice(
      3,
      0,
      createRecord(
        2,
        2n,
        -1,
        2,
        Buffer.from(
          '---\nWeekendInfo:\n TrackName: Updated Replay Track\n...\n',
          'ascii'
        )
      )
    );
  }
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

type TapeNativeSDK = NativeSDK &
  Required<
    Pick<
      NativeSDK,
      | 'getTapeReplayStatus'
      | 'setTapeReplayPaused'
      | 'setTapeReplaySpeed'
      | 'seekTapeReplay'
    >
  >;

function loadAddon(): { iRacingSdkNode: new () => TapeNativeSDK } {
  const require = createRequire(import.meta.url);
  return require(addonPath) as { iRacingSdkNode: new () => TapeNativeSDK };
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

  it('invalidates captured telemetry on stop and captures a new frame size on restart', async () => {
    const addon = loadAddon();
    const sdk = new addon.iRacingSdkNode();
    process.env.IRDASHIES_TELEMETRY_REPLAY = tapePath;
    try {
      expect(sdk.getTelemetryData()).toEqual({});
      expect(sdk.getTelemetryVariable(0)).toEqual({});
      expect(sdk.__getTelemetryTypes()).toEqual({});
      for (const frameLength of [36, 1024, 36]) {
        await writeFile(tapePath, createTapeFixture({ frameLength }));
        expect(sdk.startSDK()).toBe(true);
        expect(sdk.waitForData(20)).toBe(true);
        expect(
          floatValue(sdk.getTelemetryData().Speed.value)
        ).toBeGreaterThanOrEqual(50);
        expect(sdk.getTelemetryVariable(-1)).toEqual({});
        expect(sdk.getTelemetryVariable(6)).toEqual({});
        expect(sdk.getTelemetryVariable('missing')).toEqual({});
        expect(sdk.__getTelemetryTypes()).toHaveProperty('Speed', 4);
        expect(sdk.getSessionData()).toContain('Replay Test Track');
        expect(sdk.currDataVersion).toBe(1);
        sdk.stopSDK();
        expect(sdk.currDataVersion).toBe(-1);
        expect(sdk.getTelemetryData()).toEqual({});
        expect(sdk.getTelemetryVariable(0)).toEqual({});
        expect(sdk.__getTelemetryTypes()).toEqual({});
        expect(sdk.getSessionData()).toBe('');
      }
    } finally {
      sdk.stopSDK();
    }
  });

  it('bounds fixed-size metadata strings and drops invalid bool metadata', async () => {
    await writeFile(
      tapePath,
      createTapeFixture({
        transformVariables: (variables) => {
          variables[0].fill(0x41, 16, 48);
          variables[0].fill(0x42, 48, 112);
          variables[0].fill(0x43, 112, 144);
          variables[1].writeUInt8(2, 12); // Invalid C++ bool representation.
        },
      })
    );
    process.env.IRDASHIES_TELEMETRY_REPLAY = tapePath;
    const sdk = new (loadAddon().iRacingSdkNode)();
    try {
      expect(sdk.startSDK()).toBe(true);
      expect(sdk.waitForData(20)).toBe(true);
      const variable = sdk.getTelemetryVariable(0);
      expect(variable).toMatchObject({
        name: 'A'.repeat(32),
        description: 'B'.repeat(64),
        unit: 'C'.repeat(32),
      });
      expect(doubleValue(variable.value)).toBeGreaterThanOrEqual(10);
      expect(sdk.getTelemetryVariable(1)).toEqual({});
      expect(sdk.getTelemetryData()).not.toHaveProperty('SessionTick');
      expect(sdk.__getTelemetryTypes()).not.toHaveProperty('SessionTick');
    } finally {
      sdk.stopSDK();
    }
  });

  it.each([
    ['negative count', 8, -1],
    ['zero count', 8, 0],
    ['overflowing count', 8, 0x7fffffff],
    ['negative offset', 4, -1],
    ['past-end offset', 4, 36],
    ['overflowing offset', 4, 0x7fffffff],
    ['invalid type', 0, 6],
  ] as const)(
    'fails safely with %s in a tape descriptor',
    async (_, field, value) => {
      await writeFile(
        tapePath,
        createTapeFixture({
          transformVariables: (variables) =>
            variables[0].writeInt32LE(value, field),
        })
      );
      process.env.IRDASHIES_TELEMETRY_REPLAY = tapePath;
      const sdk = new (loadAddon().iRacingSdkNode)();
      try {
        expect(sdk.startSDK()).toBe(false);
        expect(sdk.waitForData(0)).toBe(false);
        expect(sdk.getTelemetryData()).toEqual({});
        expect(sdk.getTelemetryVariable(0)).toEqual({});
        expect(sdk.__getTelemetryTypes()).toEqual({});
      } finally {
        sdk.stopSDK();
      }
    }
  );

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

  it('seeks both directions while paused, restores session YAML, and signals a reset', async () => {
    await writeFile(
      tapePath,
      createTapeFixture({
        qpcFrequency: 1n,
        includeSessionUpdate: true,
      })
    );
    process.env.IRDASHIES_TELEMETRY_REPLAY = tapePath;
    const sdk = new (loadAddon().iRacingSdkNode)();
    try {
      expect(sdk.startSDK()).toBe(true);
      expect(sdk.waitForData(0)).toBe(true);
      expect(sdk.setTapeReplayPaused(true)).toBe(true);
      expect(sdk.getTapeReplayStatus()).toMatchObject({
        duration: 3,
        paused: true,
        speed: 1,
        ended: false,
      });

      for (const [seconds, speed, track] of [
        [2.5, 52, 'Updated Replay Track'],
        [0, 50, 'Replay Test Track'],
        [1.5, 51, 'Replay Test Track'],
        [999, 52, 'Updated Replay Track'],
      ] as const) {
        expect(sdk.seekTapeReplay(seconds)).toBe(true);
        // Every jump exposes a disconnect before publishing the new frame,
        // allowing processors and renderer histories to clear first.
        expect(sdk.waitForData(0)).toBe(false);
        expect(sdk.isRunning()).toBe(false);
        expect(sdk.getTelemetryData()).toEqual({});
        expect(sdk.waitForData(0)).toBe(true);
        expect(sdk.isRunning()).toBe(true);
        expect(floatValue(sdk.getTelemetryData().Speed.value)).toBe(speed);
        expect(sdk.getSessionData()).toContain(track);
        expect(sdk.waitForData(0)).toBe(false);
        expect(sdk.isRunning()).toBe(true);
        expect(sdk.getTapeReplayStatus()).toMatchObject({
          position: Math.min(3, seconds),
          paused: true,
        });
      }
    } finally {
      sdk.stopSDK();
    }
  });

  it('rebases the playback clock for pause/resume and speed changes', async () => {
    await writeFile(tapePath, createTapeFixture({ qpcFrequency: 1n }));
    process.env.IRDASHIES_TELEMETRY_REPLAY = tapePath;
    const sdk = new (loadAddon().iRacingSdkNode)();
    try {
      expect(sdk.startSDK()).toBe(true);
      expect(sdk.waitForData(0)).toBe(true);
      expect(sdk.setTapeReplayPaused(true)).toBe(true);
      const pausedAt = sdk.getTapeReplayStatus().position;
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(sdk.getTapeReplayStatus().position).toBe(pausedAt);
      expect(sdk.waitForData(0)).toBe(false);
      expect(sdk.isRunning()).toBe(true);
      expect(sdk.setTapeReplaySpeed(10)).toBe(true);
      expect(sdk.getTapeReplayStatus().position).toBe(pausedAt);
      expect(sdk.setTapeReplayPaused(false)).toBe(true);
      const started = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 30));
      const elapsed = (performance.now() - started) / 1000;
      expect(sdk.getTapeReplayStatus().position - pausedAt).toBeCloseTo(
        elapsed * 10,
        1
      );
      const beforeSpeedChange = sdk.getTapeReplayStatus().position;
      expect(sdk.setTapeReplaySpeed(0.5)).toBe(true);
      expect(sdk.getTapeReplayStatus().position).toBeCloseTo(
        beforeSpeedChange,
        1
      );
      const slowed = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(
        sdk.getTapeReplayStatus().position - beforeSpeedChange
      ).toBeCloseTo(((performance.now() - slowed) / 1000) * 0.5, 1);
    } finally {
      sdk.stopSDK();
    }
  });

  it('rejects malformed native control arguments and can restart after reaching the end', async () => {
    await writeFile(tapePath, createTapeFixture());
    // Windows' CRT retains the environment captured on the first addon load.
    // Earlier tests enable looping, so non-looping playback needs a fresh
    // process with its options supplied before the addon is loaded.
    const script = `
      const assert = require('node:assert/strict');
      const { iRacingSdkNode } = require(process.argv[1]);
      const sdk = new iRacingSdkNode();
      try {
        assert.equal(sdk.startSDK(), true);
        for (const speed of [NaN, Infinity, 0, -1, 101]) {
          assert.equal(sdk.setTapeReplaySpeed(speed), false);
        }
        assert.equal(sdk.seekTapeReplay(NaN), false);
        assert.equal(sdk.seekTapeReplay(Infinity), false);
        assert.equal(sdk.setTapeReplaySpeed(), false);
        assert.equal(sdk.seekTapeReplay('2'), false);
        assert.equal(sdk.setTapeReplayPaused(1), false);
        assert.equal(sdk.waitForData(20), true);
        const deadline = Date.now() + 1000;
        while (!sdk.getTapeReplayStatus().ended && Date.now() < deadline) {
          sdk.waitForData(20);
        }
        assert.equal(sdk.getTapeReplayStatus().ended, true);
        assert.equal(sdk.setTapeReplayPaused(false), true);
        assert.equal(sdk.waitForData(0), false);
        assert.equal(sdk.waitForData(0), true);
        const speed = new Float32Array(sdk.getTelemetryData().Speed.value)[0];
        assert.equal(speed, 50);
      } finally {
        sdk.stopSDK();
      }
    `;
    await execFileAsync(process.execPath, ['-e', script, addonPath], {
      env: {
        ...process.env,
        IRDASHIES_TELEMETRY_REPLAY: tapePath,
        IRDASHIES_TELEMETRY_REPLAY_SPEED: '100',
        IRDASHIES_TELEMETRY_REPLAY_LOOP: '0',
      },
      timeout: 5000,
    });
  });
});
