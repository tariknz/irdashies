import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';
import { isValidRect, type Rect } from '../windowBounds';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';

const FILE_NAME = 'settings-window-bounds.json';
const errorCode = (error: unknown): string =>
  (error as NodeJS.ErrnoException)?.code ?? 'UNKNOWN';

/**
 * This file is the one-time transition away from config.json's legacy
 * settingsWindowBounds key. Never import that rectangle: all old sizes AND
 * positions are intentionally invalidated, regardless of their dimensions.
 * The completion marker and future user bounds are one atomic record, so a
 * crash cannot commit a marker that would re-enable legacy bounds.
 */
export function createSettingsWindowBoundsStore(storageDir: string) {
  const filePath = path.join(storageDir, FILE_NAME);
  let bounds: Rect | undefined;
  let loaded: Promise<void> | undefined;
  let ready = false;
  let saveBlocked = false;
  const writer = createDebouncedAtomicWriter({
    filePath,
    serialize: () => JSON.stringify({ defaultSizeApplied: true, bounds }),
    onSuccess: () => undefined,
    onError: (error) =>
      logger.warn(
        '[SettingsWindowBounds] Failed to write',
        FILE_NAME,
        errorCode(error)
      ),
  });

  const load = (): Promise<void> =>
    (loaded ??= (async () => {
      let stored: unknown;
      try {
        stored = JSON.parse(await fsp.readFile(filePath, 'utf8'));
      } catch (error) {
        if (!(error instanceof SyntaxError) && errorCode(error) !== 'ENOENT') {
          // An unreadable file could contain a later intentional resize. Do not
          // overwrite it; use defaults this session and retry on the next run.
          saveBlocked = true;
          logger.warn(
            '[SettingsWindowBounds] Failed to read',
            FILE_NAME,
            errorCode(error)
          );
        } else if (error instanceof SyntaxError) {
          logger.warn('[SettingsWindowBounds] Invalid JSON', FILE_NAME);
        }
      }

      if (
        typeof stored === 'object' &&
        stored !== null &&
        'defaultSizeApplied' in stored &&
        stored.defaultSizeApplied === true
      ) {
        if ('bounds' in stored && isValidRect(stored.bounds)) {
          const { x, y, width, height } = stored.bounds;
          bounds = { x, y, width, height };
        }
      } else if (!saveBlocked) {
        // Startup awaits the atomic commit before any window is built. On
        // failure the writer retains dirty data for a later save/shutdown;
        // a new process safely retries the transition if nothing reached disk.
        writer.schedule();
        await writer.flush();
      }
      ready = true;
    })());

  return {
    load,
    get: (): Rect | undefined => bounds && { ...bounds },
    save(next: Rect): void {
      if (!ready || !isValidRect(next)) return;
      bounds = { ...next };
      if (!saveBlocked) writer.schedule();
    },
    async flush(): Promise<void> {
      if (loaded) await loaded;
      await writer.flush();
    },
  };
}

let store: ReturnType<typeof createSettingsWindowBoundsStore> | undefined;

/** Await once at startup, before bridges, tray actions or windows can open Settings. */
export const initializeSettingsWindowBounds = (): Promise<void> => {
  store ??= createSettingsWindowBoundsStore(app.getPath('userData'));
  return store.load();
};

/** Cache-only window construction: initialization owns all reads. */
export const readSettingsWindowBounds = (): Rect | undefined => store?.get();
export const saveSettingsWindowBounds = (bounds: Rect): void =>
  store?.save(bounds);
export const flushSettingsWindowBoundsOnShutdown = async (): Promise<void> => {
  await store?.flush();
};
