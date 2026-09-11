import { ipcMain } from 'electron';
import { clearLapTrace, getLapTrace, saveLapTrace } from '../storage/lapTraces';
import {
  getGarage61LastFolder,
  setGarage61LastFolder,
  getIbtLastFolder,
  setIbtLastFolder,
} from '../storage/appSettings';
import { getGarage61SearchSession } from '../storage/garage61SearchSession';
import {
  GARAGE61_CAR_IDS,
  GARAGE61_TRACK_IDS,
} from '../garage61/_GENERATED_ids';
import {
  LAP_TRACE_SCHEMA_VERSION,
  MAX_LAP_SAMPLES,
  type LapTraceRecord,
  type LapTraceSource,
  type Session,
} from '@irdashies/types';
import { parseIbtFile } from '../ibt/ibtImport';
import { IbtImportError } from '../ibt/ibtErrors';
import type { OverlayManager } from '../overlayManager';
import logger from '../logger';

const VALID_SOURCES: readonly LapTraceSource[] = ['best', 'manual', 'garage61'];

const isValidSource = (value: unknown): value is LapTraceSource =>
  typeof value === 'string' && VALID_SOURCES.includes(value as LapTraceSource);

const isTrackId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * A usable Garage 61 id. Written as a type guard because `Number.isInteger`
 * is typed to return a plain boolean, so it does not narrow the optional
 * session fields these ids are read out of.
 */
const isGarage61Id = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/**
 * iRacing's own track and car ids. Deliberately a separate type from
 * Garage61SearchInfo, which carries the same two fields in Garage 61's id
 * space: the two are not interchangeable and swapping them silently produces
 * a link to the wrong car.
 */
export interface IracingSearchIds {
  trackId: number;
  carId: number;
}

/**
 * The iRacing track and car ids of the session being driven, or null when it
 * does not (yet) name both. Exported so the main process can persist the same
 * identity it serves here, rather than deriving it a second way.
 *
 * Translation to Garage 61's id space happens at the bridge boundary below, so
 * what is persisted stays the raw truth and a refreshed id table applies to
 * sessions recorded before it.
 */
export const getGarage61SearchInfoFromSession = (
  session: Session | undefined
): IracingSearchIds | null => {
  const trackId = session?.WeekendInfo?.TrackID;
  const driverCarIdx = session?.DriverInfo?.DriverCarIdx;
  const carId = session?.DriverInfo?.Drivers?.find(
    (driver) => driver.CarIdx === driverCarIdx
  )?.CarID;
  if (!isGarage61Id(trackId) || !isGarage61Id(carId)) return null;
  return { trackId, carId };
};

const isArrayLike = (value: unknown): value is ArrayLike<unknown> =>
  ArrayBuffer.isView(value) || Array.isArray(value);

const isSampleArray = (value: unknown, length: number): boolean =>
  isArrayLike(value) && value.length === length;

const allFinite = (values: Iterable<unknown>): boolean => {
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  }
  return true;
};

const SAMPLE_FIELDS = [
  'distanceM',
  'timeSec',
  'throttle',
  'brake',
  'speed',
  'gear',
  'absActive',
] as const;

const isValidRecord = (value: unknown): value is LapTraceRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<LapTraceRecord>;

  if (
    record.schemaVersion !== LAP_TRACE_SCHEMA_VERSION ||
    typeof record.trackLengthM !== 'number' ||
    !Number.isFinite(record.trackLengthM) ||
    record.trackLengthM <= 0 ||
    typeof record.lapTimeSec !== 'number' ||
    !Number.isFinite(record.lapTimeSec) ||
    typeof record.recordedAt !== 'number' ||
    !Number.isFinite(record.recordedAt)
  ) {
    return false;
  }

  const samples = record.samples;
  if (!samples || typeof samples !== 'object') return false;
  const n = samples.length;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 2) return false;
  if (n > MAX_LAP_SAMPLES) return false;

  for (const field of SAMPLE_FIELDS) {
    if (!isSampleArray(samples[field], n)) return false;
  }
  // The two axes every consumer searches along must be clean numbers; a NaN
  // distance would silently break the binary searches downstream.
  if (!allFinite(samples.distanceM) || !allFinite(samples.timeSec)) {
    return false;
  }

  return true;
};

export const setupLapTraceBridge = (overlayManager?: OverlayManager) => {
  // Cross-window fan-out: Settings imports/clears a lap in its own window and
  // store; the overlay widget lives in another window and only re-reads from
  // disk when told to. These relay a Settings action to every window so the
  // overlay reloads without a hide/show. publishMessage reaches all overlay
  // (and settings) windows; the settings window has no listener so it no-ops.
  ipcMain.on('lapTrace:notifyReferenceUpdated', () => {
    overlayManager?.publishMessage('lapTrace:referenceUpdated', null);
  });
  ipcMain.on('lapTrace:requestClearBestLap', () => {
    overlayManager?.publishMessage('lapTrace:clearBestLap', null);
  });

  // Settings has no live session of its own, so it asks main (which does) for
  // the current track/car and whether a best is stored — enough to label and
  // enable the reset control. Null when nothing is being driven.
  ipcMain.handle('lapTrace:getCurrentBestLapInfo', () => {
    const session = overlayManager?.getLatestSessionData() as
      Session | undefined;
    const weekend = session?.WeekendInfo;
    const driverInfo = session?.DriverInfo;
    const trackId = weekend?.TrackID;
    const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
    const player = (driverInfo?.Drivers ?? []).find(
      (d) => d?.CarIdx === playerCarIdx
    );
    const carPath = player?.CarPath;
    if (!trackId || trackId <= 0 || !carPath) return null;

    let hasBest = false;
    try {
      hasBest = getLapTrace(trackId, carPath, 'best') !== null;
    } catch (e) {
      logger.warn('[Main] Failed to read stored best for info', e);
    }
    return {
      trackName:
        weekend?.TrackDisplayName || weekend?.TrackName || 'this track',
      carName: player?.CarScreenName || 'this car',
      hasBest,
    };
  });

  // Garage 61 numbers tracks and cars in its own id space, so the renderer is
  // served ids it can put straight into a lap-search URL. Null whenever either
  // half is unknown — a track or car newer than the bundled table, or no
  // session yet — and the caller falls back to the plain search page rather
  // than building a link to the wrong combination.
  ipcMain.handle('lapTrace:getGarage61SearchInfo', async () => {
    const iracing =
      getGarage61SearchInfoFromSession(
        overlayManager?.getLatestSessionData() as Session | undefined
      ) ?? (await getGarage61SearchSession());
    if (!iracing) return null;

    const trackId = GARAGE61_TRACK_IDS[iracing.trackId];
    const carId = GARAGE61_CAR_IDS[iracing.carId];
    if (trackId === undefined || carId === undefined) {
      logger.info(
        `[LapTrace] No Garage 61 id for iRacing track ${iracing.trackId} / car ${iracing.carId}`
      );
      return null;
    }
    return { trackId, carId };
  });

  ipcMain.handle(
    'lapTrace:get',
    (_, trackId: unknown, carPath: unknown, kind: unknown) => {
      if (
        !isTrackId(trackId) ||
        typeof carPath !== 'string' ||
        !isValidSource(kind)
      ) {
        throw new TypeError('Invalid payload for lapTrace:get');
      }
      try {
        return getLapTrace(trackId, carPath, kind);
      } catch (e) {
        // R6.4 — a read failure returns a safe default rather than throwing
        // across the bridge.
        logger.warn('[Main] Failed to read lap trace:', e);
        return null;
      }
    }
  );

  ipcMain.handle(
    'lapTrace:save',
    (_, trackId: unknown, carPath: unknown, kind: unknown, record: unknown) => {
      if (
        !isTrackId(trackId) ||
        typeof carPath !== 'string' ||
        !isValidSource(kind) ||
        !isValidRecord(record)
      ) {
        throw new TypeError('Invalid payload for lapTrace:save');
      }
      try {
        saveLapTrace(trackId, carPath, kind, record);
      } catch (e) {
        logger.error('[Main] Failed to save lap trace:', e);
        throw e;
      }
    }
  );

  ipcMain.handle(
    'lapTrace:clear',
    (_, trackId: unknown, carPath: unknown, kind: unknown) => {
      if (
        !isTrackId(trackId) ||
        typeof carPath !== 'string' ||
        !isValidSource(kind)
      ) {
        throw new TypeError('Invalid payload for lapTrace:clear');
      }
      clearLapTrace(trackId, carPath, kind);
    }
  );

  // N4/R4.3 note: the file path is chosen by the user through
  // dialog.showOpenDialog and never crosses the IPC boundary — the renderer
  // only receives the parsed best-lap result. There is no caller-supplied path
  // to allowlist-check, mirroring lapTrace:pickGarage61Csv. The .ibt is parsed
  // here in main because it is binary and can be gigabytes; only the single
  // fastest lap's samples are returned.
  ipcMain.handle('lapTrace:pickAndParseIbt', async () => {
    const { dialog } = await import('electron');
    const path = await import('node:path');
    const { app } = await import('electron');

    // Prefer the last folder used; otherwise the sim's default telemetry dir.
    const remembered = getIbtLastFolder();
    const defaultPath =
      remembered ?? path.join(app.getPath('documents'), 'iRacing', 'telemetry');

    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Lap from .ibt Telemetry',
      filters: [{ name: 'iRacing Telemetry', extensions: ['ibt'] }],
      properties: ['openFile'],
      defaultPath,
    });
    if (canceled || !filePaths[0]) return null;

    const chosen = filePaths[0];
    setIbtLastFolder(path.dirname(chosen));

    try {
      return await parseIbtFile(chosen);
    } catch (e) {
      // Logged as basename only (R11.4) — never the absolute path.
      const fileName = path.basename(chosen);
      if (e instanceof IbtImportError) {
        logger.warn(`[Main] .ibt import failed (${fileName}): ${e.code}`);
        // Surface the clean, user-facing message; keep the original as cause.
        throw new Error(e.message, { cause: e });
      }
      logger.error(`[Main] .ibt import errored (${fileName}):`, e);
      throw new Error('Could not import the selected .ibt file', { cause: e });
    }
  });

  ipcMain.handle(
    'lapTrace:fetchFromGarage61',
    (_, trackId: unknown, carPath: unknown, lapId: unknown) => {
      if (
        !isTrackId(trackId) ||
        typeof carPath !== 'string' ||
        typeof lapId !== 'string'
      ) {
        throw new TypeError('Invalid payload for lapTrace:fetchFromGarage61');
      }
      // The fetch belongs in main rather than the renderer because the renderer
      // CSP restricts connect-src. Auth token storage does not exist yet.
      logger.warn('[Main] lapTrace:fetchFromGarage61 is not implemented yet');
      throw new Error(
        'Fetching a lap trace from Garage 61 is not implemented yet'
      );
    }
  );

  // N4/R4.3 note: unlike lapTrace:importFromIbt, the file path here is chosen
  // by the user through dialog.showOpenDialog and never crosses the IPC
  // boundary — the renderer only receives { fileName, csvText }. There is no
  // caller-supplied path to allowlist-check, mirroring importDashboardFromFile.
  ipcMain.handle('lapTrace:pickGarage61Csv', async () => {
    const { dialog } = await import('electron');
    const defaultPath = getGarage61LastFolder();
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Garage 61 Lap',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile'],
      ...(defaultPath ? { defaultPath } : {}),
    });
    if (canceled || !filePaths[0]) return null;

    const path = await import('node:path');
    const { readFile } = await import('node:fs/promises');
    const fileName = path.basename(filePaths[0]);
    // Remembered regardless of whether the read below succeeds — the user
    // did navigate there, and a read failure (permissions, file deleted
    // since picking) is unrelated to where they were browsing.
    setGarage61LastFolder(path.dirname(filePaths[0]));

    try {
      const csvText = await readFile(filePaths[0], 'utf-8');
      return { fileName, csvText };
    } catch (e) {
      // Logged as basename only (R11.4) — never the absolute path.
      logger.error(`[Main] Failed to read Garage 61 CSV (${fileName}):`, e);
      throw new Error('Could not read the selected file', { cause: e });
    }
  });
};
