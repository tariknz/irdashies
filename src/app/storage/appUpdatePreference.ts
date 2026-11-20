import { readFile } from 'node:fs/promises';
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
      logger.warn('[Updates] Could not read the automatic update preference');
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
