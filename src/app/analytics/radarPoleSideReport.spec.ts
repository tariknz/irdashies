import { describe, expect, it } from 'vitest';
import { buildRadarPoleSideReport } from './radarPoleSideReport';

describe('buildRadarPoleSideReport', () => {
  const overrides = {
    '444': { restart: true, table: false },
    '95': { start: false, table: true },
  };

  it('sends only ids and sides, by track', () => {
    const report = buildRadarPoleSideReport(overrides, '2.0.0');
    expect(report.properties).toEqual({
      version: '2.0.0',
      data_hash: report.hash,
      track_count: 2,
      tracks: {
        '95': { start_left: false, table_left: true },
        '444': { restart_left: true, table_left: false },
      },
    });
    expect(report.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes the same corrections the same way, whatever the order or version', () => {
    const reordered = {
      '95': { table: true, start: false },
      '444': { table: false, restart: true },
    };
    expect(buildRadarPoleSideReport(reordered, '3.1.0').hash).toBe(
      buildRadarPoleSideReport(overrides, '2.0.0').hash
    );
  });

  it('hashes a changed side, a changed table side and a different situation apart', () => {
    const base = buildRadarPoleSideReport(overrides, '2.0.0').hash;
    const flipped = { ...overrides, '95': { start: true, table: false } };
    const otherTable = { ...overrides, '95': { start: false, table: false } };
    const otherSituation = {
      ...overrides,
      '95': { restart: false, table: true },
    };
    expect(buildRadarPoleSideReport(flipped, '2.0.0').hash).not.toBe(base);
    expect(buildRadarPoleSideReport(otherTable, '2.0.0').hash).not.toBe(base);
    expect(buildRadarPoleSideReport(otherSituation, '2.0.0').hash).not.toBe(
      base
    );
  });

  it('reports a standing grid correction, with no table side', () => {
    const report = buildRadarPoleSideReport({ '95': { grid: false } }, '2.0.0');
    expect(report.properties.tracks).toEqual({ '95': { grid_left: false } });
    const withStart = buildRadarPoleSideReport(
      { '95': { grid: false, start: true, table: false } },
      '2.0.0'
    );
    expect(withStart.properties.tracks['95']).toEqual({
      grid_left: false,
      start_left: true,
      table_left: false,
    });
    expect(withStart.hash).not.toBe(report.hash);
  });

  it('reports no corrections as an empty set, with a hash of its own', () => {
    const empty = buildRadarPoleSideReport({}, '2.0.0');
    expect(empty.properties.track_count).toBe(0);
    expect(empty.properties.tracks).toEqual({});
    expect(empty.hash).not.toBe(
      buildRadarPoleSideReport(overrides, '2.0.0').hash
    );
  });
});
