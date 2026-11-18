import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildHashedTrackReport, hashTrackTuples } from './hashedTrackReport';

const sha256 = (text: string) =>
  crypto.createHash('sha256').update(text).digest('hex');

describe('hashTrackTuples', () => {
  it('hashes one tuple per track, by numeric track id', () => {
    const records = {
      '9000000001': { a: 1, b: null },
      '95': { a: 2, b: true },
      '444': { a: 3, b: false },
    };
    expect(hashTrackTuples(records, ({ a, b }) => [a, b])).toBe(
      sha256('[["95",2,true],["444",3,false],["9000000001",1,null]]')
    );
  });
});

describe('buildHashedTrackReport', () => {
  const records = {
    '444': { value: 2 },
    '95': { value: 1 },
  };
  const build = (input: typeof records, version: string) =>
    buildHashedTrackReport(
      input,
      version,
      ({ value }) => [value],
      ({ value }) => ({ v: value })
    );

  it('sends the converted tracks by numeric id, with their count and hash', () => {
    const report = build(records, '2.0.0');
    expect(report.hash).toBe(sha256('[["95",1],["444",2]]'));
    expect(report.properties).toEqual({
      version: '2.0.0',
      data_hash: report.hash,
      track_count: 2,
      tracks: { '95': { v: 1 }, '444': { v: 2 } },
    });
    expect(Object.keys(report.properties.tracks)).toEqual(['95', '444']);
  });

  it('hashes the same tracks the same way, whatever the order or version', () => {
    const reordered = { '95': { value: 1 }, '444': { value: 2 } };
    expect(build(reordered, '3.0.0').hash).toBe(build(records, '2.0.0').hash);
  });

  it('reports no tracks as an empty set', () => {
    const report = buildHashedTrackReport(
      {},
      '2.0.0',
      () => [],
      () => ({})
    );
    expect(report.hash).toBe(sha256('[]'));
    expect(report.properties.track_count).toBe(0);
    expect(report.properties.tracks).toEqual({});
  });
});
