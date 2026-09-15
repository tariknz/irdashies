import { app } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../logger';

const FILE_NAME = 'garage61SearchSession.json';
const WRITE_DEBOUNCE_MS = 250;

export interface Garage61SearchSession {
  trackId: number;
  carId: number;
}

let cached: Garage61SearchSession | null | undefined;
let writeTimer: NodeJS.Timeout | undefined;
let writeInFlight: Promise<void> | undefined;

const filePath = () => join(app.getPath('userData'), FILE_NAME);

const isValidSession = (value: unknown): value is Garage61SearchSession =>
  !!value &&
  typeof value === 'object' &&
  Number.isInteger((value as Garage61SearchSession).trackId) &&
  (value as Garage61SearchSession).trackId > 0 &&
  Number.isInteger((value as Garage61SearchSession).carId) &&
  (value as Garage61SearchSession).carId > 0;

export const getGarage61SearchSession =
  async (): Promise<Garage61SearchSession | null> => {
    if (cached !== undefined) return cached;
    try {
      const parsed: unknown = JSON.parse(await readFile(filePath(), 'utf8'));
      // A session may arrive while this asynchronous read is pending. Never let
      // the older disk value replace the newly observed live session.
      if (cached === undefined) {
        cached = isValidSession(parsed) ? parsed : null;
      }
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? error.code
          : undefined;
      if (code !== 'ENOENT') {
        logger.warn('[Main] Failed to read Garage 61 search session', error);
      }
      if (cached === undefined) cached = null;
    }
    return cached;
  };

const enqueueWrite = () => {
  const session = cached;
  if (!session) return;
  const previous = writeInFlight ?? Promise.resolve();
  const write = previous
    .catch(() => undefined)
    .then(() => writeFile(filePath(), JSON.stringify(session), 'utf8'))
    .catch((error) =>
      logger.error('[Main] Failed to save Garage 61 search session', error)
    )
    .finally(() => {
      if (writeInFlight === write) writeInFlight = undefined;
    });
  writeInFlight = write;
};

export const saveGarage61SearchSession = (
  session: Garage61SearchSession
): void => {
  if (!isValidSession(session)) return;
  if (cached?.trackId === session.trackId && cached.carId === session.carId)
    return;
  cached = session;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = undefined;
    enqueueWrite();
  }, WRITE_DEBOUNCE_MS);
};

export const flushGarage61SearchSessionOnShutdown = async (): Promise<void> => {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = undefined;
    enqueueWrite();
  }
  await writeInFlight;
};
