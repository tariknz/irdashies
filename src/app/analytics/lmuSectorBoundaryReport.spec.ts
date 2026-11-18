import { describe, expect, it } from 'vitest';
import { buildLmuSectorBoundaryReport } from './lmuSectorBoundaryReport';

describe('buildLmuSectorBoundaryReport', () => {
  const records = {
    '2000000123': { s2StartPct: 0.41, s3StartPct: 0.72 },
    '1000123': { s2StartPct: 0.3904, s3StartPct: 0.7925 },
  };

  it('sends only track ids and lap fractions, by track', () => {
    const report = buildLmuSectorBoundaryReport(records, '3.0.0');
    expect(report.properties).toEqual({
      version: '3.0.0',
      data_hash: report.hash,
      track_count: 2,
      tracks: {
        '1000123': { s2_start_pct: 0.3904, s3_start_pct: 0.7925 },
        '2000000123': { s2_start_pct: 0.41, s3_start_pct: 0.72 },
      },
    });
    expect(report.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes the same measurements the same way, whatever the order or version', () => {
    const reordered = {
      '1000123': { s3StartPct: 0.7925, s2StartPct: 0.3904 },
      '2000000123': { s3StartPct: 0.72, s2StartPct: 0.41 },
    };
    expect(buildLmuSectorBoundaryReport(reordered, '3.1.0').hash).toBe(
      buildLmuSectorBoundaryReport(records, '3.0.0').hash
    );
  });

  it('hashes a moved line apart', () => {
    const moved = {
      ...records,
      '1000123': { s2StartPct: 0.3904, s3StartPct: 0.8 },
    };
    expect(buildLmuSectorBoundaryReport(moved, '3.0.0').hash).not.toBe(
      buildLmuSectorBoundaryReport(records, '3.0.0').hash
    );
  });
});
