import { describe, it, expect, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { parseIbtFile } from './ibtImport';
import { IbtImportError } from './ibtErrors';
import { buildIbt, type BuildIbtVar } from './ibtTestBuilder';
import { IbtVarType } from './ibtTypes';

const YAML = `---
WeekendInfo:
 TrackID: 18
 TrackLength: 3.70 km
 TrackConfigName: Grand Prix
 TrackDisplayName: Test Circuit
 TrackName: testcircuit
DriverInfo:
 DriverCarIdx: 0
 Drivers:
 - CarIdx: 0
   UserName: Test Driver
   CarPath: mycar
   CarScreenName: My Car
...
`;

const ALL_VARS: BuildIbtVar[] = [
  { name: 'Lap', type: IbtVarType.Int },
  { name: 'LapDistPct', type: IbtVarType.Float },
  { name: 'SessionTime', type: IbtVarType.Double },
  { name: 'Speed', type: IbtVarType.Float },
  { name: 'Brake', type: IbtVarType.Float },
  { name: 'Throttle', type: IbtVarType.Float },
  { name: 'Gear', type: IbtVarType.Int },
  { name: 'BrakeABSactive', type: IbtVarType.Bool },
  { name: 'OnPitRoad', type: IbtVarType.Bool },
  { name: 'PlayerCarMyIncidentCount', type: IbtVarType.Int },
];

/** A modern file, which also records the direct pedal positions. */
const ALL_VARS_WITH_RAW: BuildIbtVar[] = [
  ...ALL_VARS,
  { name: 'ThrottleRaw', type: IbtVarType.Float },
  { name: 'BrakeRaw', type: IbtVarType.Float },
];

const lapRows = (opts: {
  lap: number;
  startTime: number;
  lapTimeSec: number;
  n?: number;
  incidents?: number;
  incidentAt?: number;
}): Record<string, number>[] => {
  const {
    lap,
    startTime,
    lapTimeSec,
    n = 200,
    incidents = 0,
    incidentAt,
  } = opts;
  const rows: Record<string, number>[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    rows.push({
      Lap: lap,
      LapDistPct: f * 0.999,
      SessionTime: startTime + f * lapTimeSec,
      Speed: 60 * (0.5 + 0.5 * Math.sin(f * Math.PI)),
      Brake: 0,
      Throttle: 1,
      Gear: 4,
      BrakeABSactive: 0,
      OnPitRoad: 0,
      PlayerCarMyIncidentCount:
        incidentAt !== undefined && i >= incidentAt ? incidents + 1 : incidents,
      // Deliberately different from the processed channels above, so a test
      // can tell which pair the importer read.
      ThrottleRaw: 0.25,
      BrakeRaw: 0.75,
    });
  }
  return rows;
};

/**
 * The rows of a whole recording: the laps under test bracketed by the out-lap
 * an .ibt starts part-way through and the in-lap it stops part-way through.
 * A lap counts only when a start/finish crossing both opens and closes it, so
 * a fixture of bare laps has nothing the scanner can time.
 */
const fileRows = (
  laps: Record<string, number>[][],
  incidents = 0
): Record<string, number>[] => {
  const out = lapRows({
    lap: 0,
    startTime: -60,
    lapTimeSec: 60,
    n: 150,
    incidents,
  }).map((row) => ({
    ...row,
    // Leaves the pits: the recording joins this lap half way round.
    LapDistPct: 0.5 + (row.LapDistPct as number) * 0.5,
    OnPitRoad: 1,
  }));
  const laterLaps = laps.flat();
  const inLap = lapRows({
    lap: 90,
    startTime: 100_000,
    lapTimeSec: 40,
    n: 150,
    incidents,
  }).map((row) => ({
    ...row,
    LapDistPct: (row.LapDistPct as number) * 0.4,
    OnPitRoad: 1,
  }));
  return [...out, ...laterLaps, ...inLap];
};

const tmpFiles: string[] = [];
const writeTmpIbt = async (buf: Buffer): Promise<string> => {
  const file = path.join(
    os.tmpdir(),
    `irdashies-test-${Date.now()}-${Math.random().toString(36).slice(2)}.ibt`
  );
  await fsp.writeFile(file, buf);
  tmpFiles.push(file);
  return file;
};

afterEach(async () => {
  await Promise.all(tmpFiles.splice(0).map((f) => fsp.rm(f, { force: true })));
});

describe('parseIbtFile', () => {
  it('parses the fastest valid lap and the file session identity', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS,
      rows: fileRows([
        lapRows({ lap: 1, startTime: 0, lapTimeSec: 95, n: 180 }),
        lapRows({ lap: 2, startTime: 95, lapTimeSec: 90, n: 220 }), // fastest
        lapRows({ lap: 3, startTime: 185, lapTimeSec: 94, n: 190 }),
      ]),
    });
    const file = await writeTmpIbt(buf);
    const result = await parseIbtFile(file);

    expect(result.lapNumber).toBe(2);
    expect(result.lapTimeSec).toBeCloseTo(90, 1);
    expect(result.trackId).toBe(18);
    expect(result.carPath).toBe('mycar');
    expect(result.trackConfigName).toBe('Grand Prix');
    expect(result.trackLengthM).toBeCloseTo(3700, 1);
    expect(result.samples.pct.length).toBe(220);
    expect(result.samples.timeSec.length).toBe(220);
    expect(result.samples.timeSec[0]).toBe(0);
    expect(result.fileName.endsWith('.ibt')).toBe(true);
  });

  it('rejects a file missing a required channel', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS.filter((v) => v.name !== 'Gear'),
      rows: fileRows([lapRows({ lap: 1, startTime: 0, lapTimeSec: 90 })]),
    });
    const file = await writeTmpIbt(buf);
    await expect(parseIbtFile(file)).rejects.toMatchObject({
      code: 'missing-channels',
    });
  });

  it('rejects a file without the incident channel', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS.filter((v) => v.name !== 'PlayerCarMyIncidentCount'),
      rows: fileRows([lapRows({ lap: 1, startTime: 0, lapTimeSec: 90 })]),
    });
    const file = await writeTmpIbt(buf);
    await expect(parseIbtFile(file)).rejects.toMatchObject({
      code: 'missing-channels',
    });
  });

  it('skips a faster lap that collected an incident', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS,
      rows: fileRows([
        lapRows({ lap: 1, startTime: 0, lapTimeSec: 95, n: 180 }),
        // Quickest lap in the file, but an incident lands mid-lap.
        lapRows({
          lap: 2,
          startTime: 95,
          lapTimeSec: 88,
          n: 220,
          incidentAt: 100,
        }),
        lapRows({
          lap: 3,
          startTime: 183,
          lapTimeSec: 92,
          n: 190,
          incidents: 1,
        }),
      ]),
    });
    const file = await writeTmpIbt(buf);
    const result = await parseIbtFile(file);

    expect(result.lapNumber).toBe(3);
    expect(result.lapTimeSec).toBeCloseTo(92, 1);
  });

  it('rejects a header whose variable count cannot fit in the file', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS,
      rows: lapRows({ lap: 1, startTime: 0, lapTimeSec: 90 }),
    });

    // numVars large enough to force a multi-gigabyte varHeader allocation.
    buf.writeInt32LE(0x7fff_ffff, 24);
    const file = await writeTmpIbt(buf);
    await expect(parseIbtFile(file)).rejects.toMatchObject({
      code: 'bad-signature',
    });
  });

  it('rejects a header whose regions run past the end of the file', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS,
      rows: lapRows({ lap: 1, startTime: 0, lapTimeSec: 90 }),
    });
    // A plausible var count, but the array would end well past the file.
    buf.writeInt32LE(4096, 24);
    const file = await writeTmpIbt(buf);
    await expect(parseIbtFile(file)).rejects.toMatchObject({
      code: 'truncated',
    });
  });

  it('rejects an unsupported header version', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS,
      rows: lapRows({ lap: 1, startTime: 0, lapTimeSec: 90 }),
      version: 99,
    });
    const file = await writeTmpIbt(buf);
    await expect(parseIbtFile(file)).rejects.toBeInstanceOf(IbtImportError);
  });

  it('reports no-valid-lap when the file has only a partial lap', async () => {
    const partial = lapRows({
      lap: 1,
      startTime: 0,
      lapTimeSec: 40,
      n: 120,
    }).map((r) => ({ ...r, LapDistPct: (r.LapDistPct as number) * 0.4 }));
    const buf = buildIbt({ yaml: YAML, vars: ALL_VARS, rows: partial });
    const file = await writeTmpIbt(buf);
    await expect(parseIbtFile(file)).rejects.toMatchObject({
      code: 'no-valid-lap',
    });
  });

  it('rejects a recording with no lap between two crossings', async () => {
    // One lap's worth of rows and nothing either side of it: the recording
    // began and ended mid-lap, so its elapsed time covers an unknown part of
    // the track and cannot stand as a lap time.
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS,
      rows: lapRows({ lap: 1, startTime: 0, lapTimeSec: 90 }),
    });
    const file = await writeTmpIbt(buf);
    await expect(parseIbtFile(file)).rejects.toMatchObject({
      code: 'no-valid-lap',
    });
  });

  it('reads the direct pedal positions when the file recorded them', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS_WITH_RAW,
      rows: fileRows([lapRows({ lap: 1, startTime: 0, lapTimeSec: 90 })]),
    });
    const file = await writeTmpIbt(buf);
    const result = await parseIbtFile(file);

    // The rows carry Throttle 1 / Brake 0 and ThrottleRaw 0.25 / BrakeRaw 0.75.
    expect(result.samples.throttle[0]).toBeCloseTo(0.25, 5);
    expect(result.samples.brake[0]).toBeCloseTo(0.75, 5);
  });

  it('falls back to the processed pedals when the file has no raw channels', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS,
      rows: fileRows([lapRows({ lap: 1, startTime: 0, lapTimeSec: 90 })]),
    });
    const file = await writeTmpIbt(buf);
    const result = await parseIbtFile(file);

    expect(result.samples.throttle[0]).toBeCloseTo(1, 5);
    expect(result.samples.brake[0]).toBeCloseTo(0, 5);
  });

  it('does not read past a truncated sample region', async () => {
    const buf = buildIbt({
      yaml: YAML,
      vars: ALL_VARS,
      rows: fileRows([
        lapRows({ lap: 1, startTime: 0, lapTimeSec: 90, n: 200 }),
      ]),
      // Claim more records than the bytes actually present.
      recordCount: 100_000,
    });
    const file = await writeTmpIbt(buf);
    // Should scan only the records that exist and still find the lap.
    const result = await parseIbtFile(file);
    expect(result.lapNumber).toBe(1);
  });
});
