/**
 * Test-only helper: synthesise a valid .ibt byte buffer from a session YAML
 * string, a list of scalar variables, and sample rows. Used by the ibt specs
 * to exercise the parser without committing real (personal) telemetry files.
 *
 * Not imported by any production code path — it exists purely for the specs.
 */
import {
  IBT_DISK_SUBHEADER_SIZE,
  IBT_HEADER_SIZE,
  IBT_VAR_HEADER_SIZE,
  IBT_VAR_TYPE_BYTES,
  IbtVarType,
} from './ibtTypes';

export interface BuildIbtVar {
  name: string;
  type: IbtVarType;
}

export interface BuildIbtOptions {
  yaml: string;
  vars: BuildIbtVar[];
  /** One record per row; keys are var names, values are the raw numbers. */
  rows: Record<string, number>[];
  /** Override header.ver (defaults to 2) to test version rejection. */
  version?: number;
  /** Override sessionRecordCount (defaults to rows.length). */
  recordCount?: number;
}

const writeValue = (
  buf: Buffer,
  pos: number,
  type: IbtVarType,
  value: number
): void => {
  switch (type) {
    case IbtVarType.Char:
      buf.writeUInt8(value & 0xff, pos);
      break;
    case IbtVarType.Bool:
      buf.writeUInt8(value ? 1 : 0, pos);
      break;
    case IbtVarType.Int:
    case IbtVarType.BitField:
      buf.writeInt32LE(value | 0, pos);
      break;
    case IbtVarType.Float:
      buf.writeFloatLE(value, pos);
      break;
    case IbtVarType.Double:
      buf.writeDoubleLE(value, pos);
      break;
  }
};

export const buildIbt = (opts: BuildIbtOptions): Buffer => {
  const yamlBuf = Buffer.from(opts.yaml, 'latin1');

  // Assign each var a packed offset within a record, in declaration order.
  const offsets: number[] = [];
  let recordLen = 0;
  for (const v of opts.vars) {
    offsets.push(recordLen);
    recordLen += IBT_VAR_TYPE_BYTES[v.type];
  }

  const numVars = opts.vars.length;
  const sessionInfoOffset = IBT_HEADER_SIZE + IBT_DISK_SUBHEADER_SIZE;
  const varHeaderOffset = sessionInfoOffset + yamlBuf.length;
  const bufOffset = varHeaderOffset + numVars * IBT_VAR_HEADER_SIZE;
  const recordCount = opts.recordCount ?? opts.rows.length;
  const total = bufOffset + opts.rows.length * recordLen;

  const buf = Buffer.alloc(total);

  // irsdk_header
  buf.writeInt32LE(opts.version ?? 2, 0);
  buf.writeInt32LE(1, 4); // status
  buf.writeInt32LE(60, 8); // tickRate
  buf.writeInt32LE(1, 12); // sessionInfoUpdate
  buf.writeInt32LE(yamlBuf.length, 16);
  buf.writeInt32LE(sessionInfoOffset, 20);
  buf.writeInt32LE(numVars, 24);
  buf.writeInt32LE(varHeaderOffset, 28);
  buf.writeInt32LE(1, 32); // numBuf
  buf.writeInt32LE(recordLen, 36); // bufLen
  buf.writeInt32LE(recordCount, 48); // varBuf[0].tickCount
  buf.writeInt32LE(bufOffset, 52); // varBuf[0].bufOffset

  // irsdk_diskSubHeader
  buf.writeBigInt64LE(0n, IBT_HEADER_SIZE); // sessionStartDate
  buf.writeDoubleLE(0, IBT_HEADER_SIZE + 8);
  buf.writeDoubleLE(0, IBT_HEADER_SIZE + 16);
  buf.writeInt32LE(0, IBT_HEADER_SIZE + 24); // sessionLapCount
  buf.writeInt32LE(recordCount, IBT_HEADER_SIZE + 28);

  // session YAML
  yamlBuf.copy(buf, sessionInfoOffset);

  // varHeaders
  opts.vars.forEach((v, i) => {
    const base = varHeaderOffset + i * IBT_VAR_HEADER_SIZE;
    buf.writeInt32LE(v.type, base);
    buf.writeInt32LE(offsets[i], base + 4);
    buf.writeInt32LE(1, base + 8); // count
    buf.write(v.name, base + 16, 'latin1');
  });

  // sample rows
  opts.rows.forEach((row, r) => {
    const recStart = bufOffset + r * recordLen;
    opts.vars.forEach((v, i) => {
      writeValue(buf, recStart + offsets[i], v.type, row[v.name] ?? 0);
    });
  });

  return buf;
};
