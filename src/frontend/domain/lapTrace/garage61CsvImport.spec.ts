import { describe, it, expect } from 'vitest';
import { hydrateLapTrace } from './hydrateLapTrace';
import {
  GARAGE61_IMPORT_CAR_PATH,
  GARAGE61_IMPORT_TRACK_ID,
  parseGarage61Csv,
} from './garage61CsvImport';
import {
  sampleGarage61Csv,
  sampleGarage61FileName,
} from './fixtures/sampleGarage61Csv';

describe('parseGarage61Csv', () => {
  it('parses a well-formed export into a LapTraceRecord', () => {
    const result = parseGarage61Csv(sampleGarage61Csv, sampleGarage61FileName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { record } = result;
    // The fixture's GPS loop was constructed for a ~2000 m circumference.
    expect(record.trackLengthM).toBeGreaterThan(1500);
    expect(record.trackLengthM).toBeLessThan(2500);

    expect(record.source.label).toBe(
      'Test Driver - Test Car - Test Track (Full)'
    );
    expect(record.source.driver).toBe('Test Driver');
    expect(record.source.car).toBe('Test Car');
    expect(record.source.track).toBe('Test Track (Full)');
    expect(record.source.ref).toBe('01TESTULID12345678901234');
    expect(record.lapTimeSec).toBeCloseTo(60.895, 5);

    expect(record.trackId).toBe(GARAGE61_IMPORT_TRACK_ID);
    expect(record.carPath).toBe(GARAGE61_IMPORT_CAR_PATH);
    expect(record.trackConfigName).toBe('');
  });

  it('keeps one sample per row, ascending, for one lap only', () => {
    const result = parseGarage61Csv(sampleGarage61Csv, sampleGarage61FileName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { samples, trackLengthM } = result.record;
    const rowCount = sampleGarage61Csv.trim().split('\n').length - 1;
    // The fixture ends with two rows past the line; they belong to the next
    // lap and must not be folded back onto the start of this one.
    expect(samples.length).toBeGreaterThan(rowCount - 4);
    expect(samples.length).toBeLessThan(rowCount);
    expect(samples.distanceM.length).toBe(samples.length);

    for (let i = 1; i < samples.length; i++) {
      expect(samples.distanceM[i]).toBeGreaterThan(samples.distanceM[i - 1]);
    }
    expect(samples.distanceM[samples.length - 1]).toBeLessThan(trackLengthM);
  });

  it('integrates a clock from speed and normalises it to the filename lap time', () => {
    const result = parseGarage61Csv(sampleGarage61Csv, sampleGarage61FileName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { samples, trackLengthM } = result.record;
    const last = samples.length - 1;
    expect(samples.timeSec[0]).toBe(0);
    for (let i = 1; i <= last; i++) {
      expect(samples.timeSec[i]).toBeGreaterThanOrEqual(samples.timeSec[i - 1]);
    }
    // The clock spans exactly the fraction of the lap the rows cover.
    const coveredPct =
      (samples.distanceM[last] - samples.distanceM[0]) / trackLengthM;
    expect(samples.timeSec[last]).toBeCloseTo(60.895 * coveredPct, 3);
  });

  it('labels a renamed export with its filename', () => {
    const result = parseGarage61Csv(sampleGarage61Csv, 'my_lap_export.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Whatever the driver renamed it to identifies the lap far better than a
    // generic label; the extension is dropped since it says nothing.
    expect(result.record.source.label).toBe('my_lap_export');
    expect(result.record.source.ref).toBeUndefined();
    // Came from the speed-integrated clock, not the (absent) filename time.
    expect(result.record.lapTimeSec).toBeGreaterThan(0);
    expect(result.record.lapTimeSec).toBeLessThan(600);
    expect(result.record.lapTimeSec).not.toBeCloseTo(60.895, 1);
  });

  it('rejects a CSV missing a required column', () => {
    const withoutBrake = sampleGarage61Csv
      .split('\n')
      .map((line, i) =>
        i === 0
          ? line.replace('Brake,', '')
          : line
              .split(',')
              .filter((_, col) => col !== 4)
              .join(',')
      )
      .join('\n');

    const result = parseGarage61Csv(withoutBrake, sampleGarage61FileName);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/Brake/);
  });

  it('rejects a CSV with too few rows', () => {
    const lines = sampleGarage61Csv.split('\n');
    const truncated = lines.slice(0, 4).join('\n');

    const result = parseGarage61Csv(truncated, sampleGarage61FileName);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/too few rows/i);
  });

  it('produces a record that hydrates cleanly', () => {
    const result = parseGarage61Csv(sampleGarage61Csv, sampleGarage61FileName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const view = hydrateLapTrace(result.record);
    expect(Number.isFinite(view.speedMinMs)).toBe(true);
    expect(Number.isFinite(view.speedMaxMs)).toBe(true);
    expect(view.speedMinMs).toBeLessThanOrEqual(view.speedMaxMs);
    expect(view.gearChangeM.length).toBe(view.gearChangeValues.length);
  });

  it('yields the brake and throttle events from the fixture on hydrate', () => {
    const result = parseGarage61Csv(sampleGarage61Csv, sampleGarage61FileName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { events } = hydrateLapTrace(result.record);
    expect(events.brakeOnM.length).toBe(1);
    expect(events.brakeOffM.length).toBe(1);
    // One, not two: the fixture's first row is already at full throttle, and
    // the tracker seeds from it rather than reporting an application at the
    // line — only the genuine re-application after the brake zone counts.
    expect(events.throttleOnM.length).toBe(1);
  });

  it('does not let a neutral (gear 0) blip from a shift become a gear label', () => {
    const lines = sampleGarage61Csv.split('\n');
    const columns = lines[0].split(',');
    const gearCol = columns.indexOf('Gear');
    const pctCol = columns.indexOf('LapDistPct');

    // Row 2 (buildRows i=1) sits in the fixture's gear-5 stretch (i < 14).
    const donorRow = lines[2].split(',');
    expect(donorRow[gearCol]).toBe('5');

    // Clone it a hair further along but reporting neutral — the sensor blip
    // a clutchless/sequential shift produces, not a gear the driver selected.
    const neutralRow = [...donorRow];
    neutralRow[gearCol] = '0';
    neutralRow[pctCol] = String(Number(donorRow[pctCol]) + 0.0001);
    const withNeutralBlip = [
      ...lines.slice(0, 3),
      neutralRow.join(','),
      ...lines.slice(3),
    ].join('\n');

    const original = parseGarage61Csv(
      sampleGarage61Csv,
      sampleGarage61FileName
    );
    const modified = parseGarage61Csv(withNeutralBlip, sampleGarage61FileName);
    expect(original.ok && modified.ok).toBe(true);
    if (!original.ok || !modified.ok) return;

    // The blip is stored faithfully as a sample...
    expect(modified.record.samples.length).toBe(
      original.record.samples.length + 1
    );
    // ...but the gear labels are unchanged, and none of them is "N".
    const before = hydrateLapTrace(original.record).gearChangeValues;
    const after = hydrateLapTrace(modified.record).gearChangeValues;
    expect(Array.from(after)).toEqual(Array.from(before));
    expect(Array.from(after)).not.toContain(0);
  });
});
