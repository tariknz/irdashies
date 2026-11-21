import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildIbt } from '../../src/app/ibt/ibtTestBuilder.ts';
import { IbtVarType } from '../../src/app/ibt/ibtTypes.ts';
import {
  createDoctorReport,
  doctorMarkdown,
  parseDoctorOptions,
  summarizeDoctorChecks,
  type DoctorCheck,
} from './doctor';
import { convertIbtToTape, inspectIbtRecording } from './ibt';

describe('performance CLI doctor', () => {
  it('converts IBT session data and frames into an IRDT replay', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-ibt-'));
    try {
      const source = path.join(directory, 'test.ibt');
      const target = path.join(directory, 'test.irdt');
      const yaml = 'WeekendInfo: {}\n';
      await writeFile(
        source,
        buildIbt({
          yaml,
          vars: [{ name: 'Speed', type: IbtVarType.Float }],
          rows: [{ Speed: 42 }, { Speed: 43 }],
        })
      );
      await convertIbtToTape(source, target);
      const tape = await readFile(target);
      expect(tape.toString('ascii', 0, 7)).toBe('IRDTRCE');
      expect(tape.readBigUInt64LE(40)).toBe(60n);
      expect(tape.readBigUInt64LE(48)).toBe(4n);
      const sessionRecord = 96 + 112 + 144;
      expect(tape.readUInt32LE(sessionRecord)).toBe(2);
      expect(
        tape.toString(
          'latin1',
          sessionRecord + 40,
          sessionRecord + 40 + yaml.length
        )
      ).toBe(yaml);
      const firstFrame = sessionRecord + 40 + yaml.length;
      expect(tape.readUInt32LE(firstFrame)).toBe(1);
      expect(tape.readFloatLE(firstFrame + 40)).toBe(42);
      const secondFrame = firstFrame + 44;
      expect(tape.readBigUInt64LE(secondFrame + 16)).toBe(1n);
      expect(tape.readFloatLE(secondFrame + 40)).toBe(43);
      expect(tape.readUInt32LE(secondFrame + 44)).toBe(5);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('defaults to the development target and resolves an optional input path', () => {
    expect(parseDoctorOptions([])).toMatchObject({
      target: 'dev',
      format: 'md',
    });
    expect(
      parseDoctorOptions(['--target', 'packaged', '--format', 'json'])
    ).toMatchObject({ target: 'packaged', format: 'json' });
    expect(
      parseDoctorOptions(['--target', 'packaged', '--input', 'session.irdt'])
    ).toMatchObject({
      target: 'packaged',
      inputPath: expect.stringMatching(/session\.irdt$/),
    });
  });

  it.each([
    ['--target', 'unknown'],
    ['--target'],
    ['--input'],
    ['--input', 'a.ibt', '--input', 'b.irdt'],
    ['--unknown', 'value'],
  ])('rejects invalid options: %s', (...args) => {
    expect(() => parseDoctorOptions(args)).toThrow();
  });

  it('validates IBT headers, variable regions and sample regions', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'perf-doctor-ibt-'));
    try {
      const validPath = path.join(directory, 'valid.ibt');
      const valid = buildIbt({
        yaml: 'WeekendInfo:\n TrackID: 1\n',
        vars: [
          { name: 'SessionTime', type: IbtVarType.Double },
          { name: 'Speed', type: IbtVarType.Float },
        ],
        rows: [
          { SessionTime: 1, Speed: 10 },
          { SessionTime: 2, Speed: 20 },
        ],
      });
      await writeFile(validPath, valid);
      await expect(
        inspectIbtRecording(validPath, valid.length)
      ).resolves.toMatchObject({ valid: true });

      const badPath = path.join(directory, 'bad.ibt');
      const bad = buildIbt({
        yaml: 'WeekendInfo:\n TrackID: 1\n',
        vars: [{ name: 'Speed', type: IbtVarType.Float }],
        rows: [{ Speed: 10 }],
        version: 3,
      });
      await writeFile(badPath, bad);
      await expect(
        inspectIbtRecording(badPath, bad.length)
      ).resolves.toMatchObject({
        valid: false,
        detail: expect.stringContaining('Unsupported IBT header version'),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('summarizes failed checks separately from warnings and skipped probes', () => {
    const checks: DoctorCheck[] = [
      { name: 'node', status: 'PASS', detail: 'supported' },
      { name: 'native addon', status: 'FAIL', detail: 'missing' },
      { name: 'source tree', status: 'WARN', detail: 'dirty' },
      { name: 'live simulator', status: 'SKIP', detail: 'not probed' },
    ];
    const report = createDoctorReport('dev', checks);

    expect(report.summary).toEqual({
      passed: 1,
      warnings: 1,
      failed: 1,
      skipped: 1,
    });
    expect(summarizeDoctorChecks(checks)).toEqual(report.summary);
    expect(doctorMarkdown(report)).toContain(
      'Checks are read-only; no application was launched.'
    );
    expect(doctorMarkdown(report)).toContain(
      '1 passed, 1 warnings, 1 failed, 1 skipped'
    );
  });
});
