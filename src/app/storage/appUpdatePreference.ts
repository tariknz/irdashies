import { readFile } from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';

export async function openAppUpdatePreference(
  filePath: string,
  onSaveFailed: (failed: boolean) => void
) {
  let enabled = true;
  try {
    const stored: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    enabled = stored !== false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      const fileName = path.basename(filePath);
      const detail =
        error instanceof SyntaxError
          ? 'Invalid JSON'
          : error instanceof Error
            ? error.message.replaceAll(filePath, fileName)
            : 'Unknown read error';
      logger.warn(
        '[Updates] Could not read the automatic update preference',
        fileName,
        detail
      );
    }
  }

  const writer = createDebouncedAtomicWriter({
    filePath,
    serialize: () => JSON.stringify(enabled),
    onSuccess: () => onSaveFailed(false),
    onError: () => {
      logger.warn('[Updates] Could not save the automatic update preference');
      onSaveFailed(true);
    },
  });

  return {
    get enabled() {
      return enabled;
    },
    save(value: boolean) {
      enabled = value;
      writer.schedule();
    },
    flush: writer.flush,
  };
}
