import { csvParse } from 'd3';
import type { LapTraceRecord } from '@irdashies/types';
import { LAP_TRACE_SCHEMA_VERSION } from '@irdashies/types';
import { SampleBuffer, normalisePct } from './lapSamples';

/**
 * Converts a Garage 61 CSV lap export into a LapTraceRecord.
 *
 * A Garage 61 export carries no numeric iRacing TrackID/CarPath — only
 * human-readable names in its filename — and this app has no lookup table
 * from those names to real IDs. So the imported lap is not matched against
 * the live session at all: it is stored under a fixed sentinel key and shown
 * whenever 'garage61' is the selected reference source, regardless of which
 * car/track is actually loaded. (Known limitation: if the live session is a
 * different track, the overlay will show mismatched data.)
 *
 * The export is one row per telemetry frame (~60 Hz), each with its own
 * LapDistPct, so every row becomes one sample. It carries no time column;
 * time is integrated from speed and distance and then normalised to the lap
 * time in the filename, which is the sim's own figure.
 */
export const GARAGE61_IMPORT_TRACK_ID = -61;
export const GARAGE61_IMPORT_CAR_PATH = '__garage61_import__';

const EARTH_RADIUS_M = 6_371_000;

const REQUIRED_HEADERS = [
  'Speed',
  'LapDistPct',
  'Brake',
  'Throttle',
  'Gear',
  'ABSActive',
  'Lat',
  'Lon',
] as const;

/** A real lap is thousands of rows — this just rejects obviously-truncated files. */
const MIN_ROWS = 10;

/** Guards the speed-integrated clock against blowing up near a standstill. */
const MIN_INTEGRATION_SPEED_MS = 0.5;

/** A drop in LapDistPct larger than this between rows is the start/finish line. */
const WRAP_PCT = 0.5;

export type Garage61ParseResult =
  { ok: true; record: LapTraceRecord } | { ok: false; message: string };

interface Garage61Row {
  /** Normalised into [0, 1) — see lapSamples.normalisePct. */
  pct: number;
  throttle: number;
  brake: number;
  speed: number;
  gear: number;
  absActive: boolean;
  lat: number;
  lon: number;
}

function haversineMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Garage 61's export filename convention:
 * "Garage 61 - {Driver} - {Car} - {Track (Layout)} - {MM.SS.mmm} - {ULID}.csv"
 * Used only for the display label/lap time, never for track/car matching —
 * and must degrade gracefully if the file was renamed.
 */
function parseFilename(fileName: string): {
  label: string;
  driver?: string;
  car?: string;
  track?: string;
  ref?: string;
  lapTimeSec: number | null;
} {
  const base = fileName.replace(/\.csv$/i, '');
  const segments = base.split(' - ');

  if (segments.length >= 6 && segments[0] === 'Garage 61') {
    const driver = segments[1];
    const car = segments[2];
    const track = segments[3];
    const lapTimeStr = segments[4];
    const ref = segments[segments.length - 1];

    const match = /^(\d+)\.(\d{2})\.(\d{3})$/.exec(lapTimeStr);
    const lapTimeSec = match
      ? Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 1000
      : null;

    return {
      label: `${driver} - ${car} - ${track}`,
      driver,
      car,
      track,
      ref,
      lapTimeSec,
    };
  }

  // Renamed, or exported under a convention we do not know. The filename is
  // the only thing left that identifies the lap, and it is very likely what
  // the driver renamed it to, so it beats a generic "imported" label.
  return {
    label: base,
    driver: undefined,
    car: undefined,
    track: undefined,
    ref: undefined,
    lapTimeSec: null,
  };
}

/**
 * The longest run of rows without a start/finish wrap. An export normally
 * covers one lap plus a few rows either side of the line; a lap is the rows
 * between the wraps, and if the file starts just before the line the short
 * pre-line tail is the part to discard.
 */
function longestLapRun(rows: Garage61Row[]): { start: number; end: number } {
  let bestStart = 0;
  let bestEnd = 0;
  let start = 0;
  for (let i = 1; i <= rows.length; i++) {
    const wrapped = i < rows.length && rows[i].pct < rows[i - 1].pct - WRAP_PCT;
    if (wrapped || i === rows.length) {
      if (i - start > bestEnd - bestStart) {
        bestStart = start;
        bestEnd = i;
      }
      start = i;
    }
  }
  return { start: bestStart, end: bestEnd };
}

export function parseGarage61Csv(
  csvText: string,
  fileName: string,
  importedAt: number = Date.now()
): Garage61ParseResult {
  const parsed = csvParse(csvText);
  const columns = parsed.columns ?? [];
  const missing = REQUIRED_HEADERS.filter(
    (header) => !columns.includes(header)
  );
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Garage 61 CSV is missing required column(s): ${missing.join(', ')}`,
    };
  }
  if (parsed.length < MIN_ROWS) {
    return {
      ok: false,
      message: `Garage 61 CSV has too few rows (${parsed.length}) to build a lap trace`,
    };
  }

  const rows: Garage61Row[] = parsed.map((row) => ({
    pct: normalisePct(Number(row.LapDistPct)),
    throttle: Number(row.Throttle),
    brake: Number(row.Brake),
    speed: Number(row.Speed),
    gear: Number(row.Gear),
    absActive: row.ABSActive === 'true',
    lat: Number(row.Lat),
    lon: Number(row.Lon),
  }));

  // Pass 1: track length from GPS distance. Distance is summed between every
  // consecutive fix regardless of the pct wrap (Haversine only cares about
  // lat/lon); the pct delta is unwrapped across the line, so dividing the two
  // gives metres-per-lap directly, whether the file covers exactly one lap or
  // a little more.
  let totalDistanceM = 0;
  let totalUnwrappedPctDelta = 0;
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    totalDistanceM += haversineMetres(prev.lat, prev.lon, curr.lat, curr.lon);
    const unwrappedCurrPct = curr.pct < prev.pct ? curr.pct + 1 : curr.pct;
    totalUnwrappedPctDelta += unwrappedCurrPct - prev.pct;
  }

  const trackLengthM =
    totalUnwrappedPctDelta > 0 ? totalDistanceM / totalUnwrappedPctDelta : 0;
  if (!Number.isFinite(trackLengthM) || trackLengthM <= 0) {
    return {
      ok: false,
      message: 'Could not derive a track length from the CSV GPS data',
    };
  }

  const {
    label,
    driver,
    car,
    track,
    ref,
    lapTimeSec: lapTimeSecFromFilename,
  } = parseFilename(fileName);

  // Pass 2: one sample per row of the lap's own run, with the clock
  // integrated from speed over distance (trapezoid). The buffer enforces
  // ascending distance, so a duplicated row is dropped rather than stored.
  const { start, end } = longestLapRun(rows);
  const buffer = new SampleBuffer(end - start);
  let t = 0;
  for (let i = start; i < end; i++) {
    const row = rows[i];
    if (i > start) {
      const prev = rows[i - 1];
      const dd = Math.max(0, (row.pct - prev.pct) * trackLengthM);
      const avgSpeed = Math.max(
        MIN_INTEGRATION_SPEED_MS,
        (prev.speed + row.speed) / 2
      );
      t += dd / avgSpeed;
    }
    const pushed = buffer.push(
      row.pct * trackLengthM,
      t,
      row.throttle,
      row.brake,
      row.speed,
      row.gear,
      row.absActive ? 1 : 0
    );
    if (pushed === 'full') {
      return {
        ok: false,
        message: 'Garage 61 CSV has too many rows to import as one lap',
      };
    }
  }
  if (buffer.length < 2) {
    return {
      ok: false,
      message: 'Garage 61 CSV does not contain a drivable lap',
    };
  }

  // The integrated clock is only as good as the speed trace; the filename
  // carries the sim's own lap time, so scale the clock to match it over the
  // fraction of the lap the rows actually cover. Without a filename time the
  // integrated total, extrapolated to a full lap, is the best available.
  const last = buffer.length - 1;
  const coveredPct =
    (buffer.distanceM[last] - buffer.distanceM[0]) / trackLengthM;
  const integratedSpan = buffer.timeSec[last];
  let lapTimeSec = lapTimeSecFromFilename ?? integratedSpan / coveredPct;
  if (!Number.isFinite(lapTimeSec) || lapTimeSec <= 0) lapTimeSec = -1;
  if (lapTimeSecFromFilename !== null && integratedSpan > 0 && coveredPct > 0) {
    const scale = (lapTimeSecFromFilename * coveredPct) / integratedSpan;
    for (let i = 0; i <= last; i++) buffer.timeSec[i] *= scale;
  }

  const record: LapTraceRecord = {
    schemaVersion: LAP_TRACE_SCHEMA_VERSION,
    source: { kind: 'garage61', label, driver, car, track, ref, importedAt },
    trackId: GARAGE61_IMPORT_TRACK_ID,
    // Deliberately empty: LapTraceStore's adaptStoredRecord only rejects a
    // mismatch when BOTH sides are non-empty, so this always short-circuits
    // to "allow" regardless of the live session's actual track config.
    trackConfigName: '',
    carPath: GARAGE61_IMPORT_CAR_PATH,
    trackLengthM,
    lapTimeSec,
    samples: buffer.toRecordSamples(),
    recordedAt: importedAt,
  };

  return { ok: true, record };
}
