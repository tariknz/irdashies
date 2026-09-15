import type { IbtImportResult, LapTraceRecord } from '@irdashies/types';
import { LAP_TRACE_SCHEMA_VERSION } from '@irdashies/types';
import { SampleBuffer, normalisePct } from './lapSamples';

/**
 * Sentinel key for the single imported-.ibt slot, mirroring the Garage 61 one.
 *
 * An imported lap is stored globally rather than under the track and car it
 * was driven on, so it can be plotted whatever session is running. Comparing a
 * lap from another circuit is rarely useful, but refusing to show the file the
 * driver just picked is worse than letting them see it and decide.
 */
export const IBT_IMPORT_TRACK_ID = -62;
export const IBT_IMPORT_CAR_PATH = '__ibt_import__';

/**
 * Converts the fastest-lap samples returned by the main-process .ibt parser
 * into a LapTraceRecord.
 *
 * One sample per .ibt row, through the same SampleBuffer as the live recorder
 * and the Garage 61 path, so an imported .ibt lap is indistinguishable from
 * any other reference to downstream consumers. Unlike the CSV path, track
 * length, lap time and per-sample time all come from the file itself, so
 * there is no GPS-derived guessing here.
 */
export function ibtSamplesToLapTrace(
  result: IbtImportResult,
  importedAt: number = Date.now()
): LapTraceRecord {
  const { samples, trackLengthM } = result;
  const n = samples.pct.length;

  const buffer = new SampleBuffer(n);
  for (let i = 0; i < n; i++) {
    const pushed = buffer.push(
      normalisePct(samples.pct[i]) * trackLengthM,
      samples.timeSec[i],
      samples.throttle[i],
      samples.brake[i],
      samples.speed[i],
      samples.gear[i],
      samples.absActive[i] ? 1 : 0
    );
    if (pushed === 'full') {
      throw new Error('The .ibt lap has too many samples to import');
    }
  }
  if (buffer.length < 2) {
    throw new Error('The .ibt lap contains no usable samples');
  }

  const label = buildLabel(result);
  const record: LapTraceRecord = {
    schemaVersion: LAP_TRACE_SCHEMA_VERSION,
    source: {
      kind: 'manual',
      label,
      ref: result.fileName,
      importedAt,
      driver: result.driverName,
      car: result.carScreenName,
      track: result.trackDisplayName,
    },
    trackId: IBT_IMPORT_TRACK_ID,
    // Blank rather than the file's own layout: the record is not keyed to a
    // layout any more, and a real name here would make the load-time guard
    // reject it everywhere but the circuit it came from. The layout still
    // reaches the widget through `source.track`.
    trackConfigName: '',
    carPath: IBT_IMPORT_CAR_PATH,
    trackLengthM,
    lapTimeSec: result.lapTimeSec,
    samples: buffer.toRecordSamples(),
    recordedAt: importedAt,
  };

  return record;
}

function buildLabel(result: IbtImportResult): string {
  const parts = [
    result.driverName,
    result.carScreenName,
    result.trackDisplayName,
  ].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' - ') : result.fileName;
}
