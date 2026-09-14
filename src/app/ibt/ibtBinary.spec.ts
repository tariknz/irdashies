import { describe, it, expect } from 'vitest';
import {
  parseHeader,
  parseDiskSubHeader,
  parseVarHeaders,
  readVarValue,
} from './ibtBinary';
import { IBT_VAR_HEADER_SIZE, IbtVarType } from './ibtTypes';
import { buildIbt } from './ibtTestBuilder';

const vars = [
  { name: 'Lap', type: IbtVarType.Int },
  { name: 'LapDistPct', type: IbtVarType.Float },
  { name: 'SessionTime', type: IbtVarType.Double },
  { name: 'Speed', type: IbtVarType.Float },
  { name: 'OnPitRoad', type: IbtVarType.Bool },
];

const buf = buildIbt({
  yaml: 'WeekendInfo:\n TrackID: 1\n',
  vars,
  rows: [
    { Lap: 3, LapDistPct: 0.25, SessionTime: 12.5, Speed: 55.5, OnPitRoad: 0 },
    { Lap: 3, LapDistPct: 0.75, SessionTime: 13.5, Speed: 60.25, OnPitRoad: 1 },
  ],
});

describe('parseHeader', () => {
  it('reads header fields and the sample-buffer offset from varBuf[0]', () => {
    const header = parseHeader(buf);
    expect(header.ver).toBe(2);
    expect(header.numVars).toBe(vars.length);
    // 4 (Lap) + 4 (Pct) + 8 (SessionTime) + 4 (Speed) + 1 (bool) = 21
    expect(header.bufLen).toBe(21);
    expect(header.varHeaderOffset).toBeGreaterThan(0);
    expect(header.bufOffset).toBeGreaterThan(header.varHeaderOffset);
  });

  it('throws on a buffer smaller than the header', () => {
    expect(() => parseHeader(Buffer.alloc(10))).toThrow(/header/i);
  });
});

describe('parseDiskSubHeader', () => {
  it('reads the record count', () => {
    expect(parseDiskSubHeader(buf).sessionRecordCount).toBe(2);
  });
});

describe('parseVarHeaders', () => {
  it('resolves names, types and packed offsets in order', () => {
    const header = parseHeader(buf);
    const region = buf.subarray(
      header.varHeaderOffset,
      header.varHeaderOffset + header.numVars * IBT_VAR_HEADER_SIZE
    );
    const headers = parseVarHeaders(region, header.numVars);
    expect(headers.map((h) => h.name)).toEqual([
      'Lap',
      'LapDistPct',
      'SessionTime',
      'Speed',
      'OnPitRoad',
    ]);
    expect(headers[2].type).toBe(IbtVarType.Double);
    // Speed sits after int(4)+float(4)+double(8) = offset 16.
    expect(headers[3].offset).toBe(16);
  });
});

describe('readVarValue', () => {
  it('decodes each scalar type from a record row', () => {
    const header = parseHeader(buf);
    const region = buf.subarray(
      header.varHeaderOffset,
      header.varHeaderOffset + header.numVars * IBT_VAR_HEADER_SIZE
    );
    const headers = parseVarHeaders(region, header.numVars);
    const row1 = buf.subarray(
      header.bufOffset,
      header.bufOffset + header.bufLen
    );
    const row2 = buf.subarray(
      header.bufOffset + header.bufLen,
      header.bufOffset + 2 * header.bufLen
    );

    expect(readVarValue(row1, headers[0])).toBe(3); // Lap (int)
    expect(readVarValue(row1, headers[1])).toBeCloseTo(0.25, 5); // Pct (float)
    expect(readVarValue(row1, headers[2])).toBeCloseTo(12.5, 9); // Time (double)
    expect(readVarValue(row1, headers[4])).toBe(0); // OnPitRoad false
    expect(readVarValue(row2, headers[4])).toBe(1); // OnPitRoad true
  });
});
