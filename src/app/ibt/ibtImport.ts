/**
 * Orchestrates a bounded, streaming .ibt import: open the file, read only the
 * small header/varHeader/session regions up front, then stream the sample
 * region in chunks through the best-lap scanner. The whole file is never held
 * in memory (an endurance .ibt can be gigabytes), and only the fastest valid
 * lap's samples survive — everything else is discarded as it streams.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  parseDiskSubHeader,
  parseHeader,
  parseVarHeaders,
  readVarValue,
} from './ibtBinary';
import { parseIbtSessionInfo } from './ibtSessionInfo';
import { IbtBestLapScanner, type IbtSample } from './ibtBestLap';
import {
  IBT_DISK_SUBHEADER_SIZE,
  IBT_HEADER_SIZE,
  IBT_SUPPORTED_VERSION,
  IBT_VAR_HEADER_SIZE,
  type IbtSessionMeta,
  type IbtVarHeader,
} from './ibtTypes';
import { IbtImportError } from './ibtErrors';
import type { IbtImportResult } from '@irdashies/types';
import logger from '../logger';

const REQUIRED_VARS = [
  'Lap',
  'LapDistPct',
  'SessionTime',
  'Speed',
  'Brake',
  'Throttle',
  'Gear',
] as const;

/**
 * `ThrottleRaw`/`BrakeRaw` are optional rather than required: they carry the
 * direct pedal position, but an older .ibt may not have recorded them, and a
 * file that imports today must keep importing. See the sample mapper below.
 */
const OPTIONAL_VARS = [
  'BrakeABSactive',
  'OnPitRoad',
  'ThrottleRaw',
  'BrakeRaw',
] as const;

/** Target chunk size for the streaming read — rounded down to whole records. */
const TARGET_CHUNK_BYTES = 1024 * 1024;

const readRegion = async (
  handle: fsp.FileHandle,
  position: number,
  length: number
): Promise<Buffer> => {
  const buf = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buf, 0, length, position);
  if (bytesRead < length) {
    throw new IbtImportError(
      'truncated',
      'The .ibt file ended before an expected region'
    );
  }
  return buf;
};

/**
 * Parse an .ibt file and return its fastest valid lap. Throws IbtImportError
 * for any unrecoverable problem (bad file, missing channels, no valid lap).
 */
export const parseIbtFile = async (
  filePath: string
): Promise<IbtImportResult> => {
  let handle: fsp.FileHandle;
  try {
    handle = await fsp.open(filePath, 'r');
  } catch (e) {
    logger.warn(`[Main] Could not open .ibt (${path.basename(filePath)})`, e);
    throw new IbtImportError('unreadable', 'Could not open the selected file');
  }

  try {
    const { size } = await handle.stat();

    // One prefix read covers both the header and the disk sub-header; both
    // parsers index from the start of the file.
    const prefix = await readRegion(
      handle,
      0,
      IBT_HEADER_SIZE + IBT_DISK_SUBHEADER_SIZE
    );
    const header = parseHeader(prefix);

    // No magic bytes exist in an .ibt — the first int is the version. An
    // implausible version or nonsensical offsets means this is not an .ibt.
    if (header.ver !== IBT_SUPPORTED_VERSION) {
      throw new IbtImportError(
        header.ver > 0 && header.ver < 100
          ? 'unsupported-version'
          : 'bad-signature',
        `Unsupported .ibt version (${header.ver})`
      );
    }
    if (
      header.numVars <= 0 ||
      header.bufLen <= 0 ||
      header.varHeaderOffset <= 0 ||
      header.sessionInfoOffset <= 0 ||
      header.bufOffset <= 0
    ) {
      throw new IbtImportError('bad-signature', 'Not a valid .ibt file');
    }

    const sub = parseDiskSubHeader(prefix);

    const varHeaderBuf = await readRegion(
      handle,
      header.varHeaderOffset,
      header.numVars * IBT_VAR_HEADER_SIZE
    );
    const varHeaders = parseVarHeaders(varHeaderBuf, header.numVars);

    const sessionBuf = await readRegion(
      handle,
      header.sessionInfoOffset,
      header.sessionInfoLen
    );
    const meta: IbtSessionMeta = parseIbtSessionInfo(
      sessionBuf.toString('latin1').replace(/\0+$/, '')
    );

    const byName = new Map(varHeaders.map((v) => [v.name, v]));
    const required: Record<string, IbtVarHeader> = {};
    const missing: string[] = [];
    for (const name of REQUIRED_VARS) {
      const v = byName.get(name);
      if (v) required[name] = v;
      else missing.push(name);
    }
    if (missing.length > 0) {
      throw new IbtImportError(
        'missing-channels',
        `The .ibt file is missing required channel(s): ${missing.join(', ')}`
      );
    }
    const optional: Record<string, IbtVarHeader | undefined> = {};
    for (const name of OPTIONAL_VARS) optional[name] = byName.get(name);

    const best = await streamSamples(handle, header, sub, size, (record) => ({
      lap: readVarValue(record, required.Lap),
      pct: readVarValue(record, required.LapDistPct),
      sessionTime: readVarValue(record, required.SessionTime),
      speed: readVarValue(record, required.Speed),
      // Raw pedal position where the file has it, matching what the live
      // recorder stores (LapTraceSampleProcessor): a lap trace shows what the
      // driver's feet did, with iRacing's own input processing bypassed.
      // Without it the imported reference would be measured differently from
      // the ghost drawn over it. The processed channel stands in otherwise.
      brake: readVarValue(record, optional.BrakeRaw ?? required.Brake),
      throttle: readVarValue(record, optional.ThrottleRaw ?? required.Throttle),
      gear: readVarValue(record, required.Gear),
      absActive: optional.BrakeABSactive
        ? readVarValue(record, optional.BrakeABSactive)
        : 0,
      onPitRoad: optional.OnPitRoad
        ? readVarValue(record, optional.OnPitRoad)
        : 0,
    }));

    if (!best) {
      throw new IbtImportError(
        'no-valid-lap',
        'No complete, clean lap was found in the file'
      );
    }

    return {
      fileName: path.basename(filePath),
      lapNumber: best.lapNumber,
      lapTimeSec: best.lapTimeSec,
      trackId: meta.trackId,
      trackConfigName: meta.trackConfigName,
      carPath: meta.carPath,
      trackLengthM: meta.trackLengthM,
      trackDisplayName: meta.trackDisplayName,
      driverName: meta.driverName,
      carScreenName: meta.carScreenName,
      samples: best.samples,
    };
  } finally {
    await handle.close();
  }
};

/**
 * Stream the sample region in ~1 MB chunks, decoding each record and feeding
 * the scanner. Yields to the event loop between chunks so a large file does not
 * block the main process (R13/responsiveness).
 */
const streamSamples = async (
  handle: fsp.FileHandle,
  header: { bufOffset: number; bufLen: number },
  sub: { sessionRecordCount: number },
  fileSize: number,
  decode: (record: Buffer) => IbtSample
): Promise<ReturnType<IbtBestLapScanner['finish']>> => {
  const recordLen = header.bufLen;
  // Clamp to what the file actually holds — a file still being written, or
  // truncated, must not read past its end.
  const available = Math.max(
    0,
    Math.floor((fileSize - header.bufOffset) / recordLen)
  );
  const recordCount =
    sub.sessionRecordCount > 0
      ? Math.min(sub.sessionRecordCount, available)
      : available;

  const recordsPerChunk = Math.max(
    1,
    Math.floor(TARGET_CHUNK_BYTES / recordLen)
  );
  const chunk = Buffer.alloc(recordsPerChunk * recordLen);
  const scanner = new IbtBestLapScanner();

  let done = 0;
  while (done < recordCount) {
    const thisChunk = Math.min(recordsPerChunk, recordCount - done);
    const bytes = thisChunk * recordLen;
    const position = header.bufOffset + done * recordLen;
    const { bytesRead } = await handle.read(chunk, 0, bytes, position);
    const usableRecords = Math.floor(bytesRead / recordLen);
    if (usableRecords === 0) break;

    for (let i = 0; i < usableRecords; i++) {
      const start = i * recordLen;
      scanner.push(decode(chunk.subarray(start, start + recordLen)));
    }

    done += usableRecords;
    if (usableRecords < thisChunk) break;
    // Give the event loop a turn between chunks.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return scanner.finish();
};
