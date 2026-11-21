import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';

export function createReportHashFile(fileName: string, logTag: string) {
  let filePath: string | undefined;
  let written: string | undefined;
  let writer: ReturnType<typeof createDebouncedAtomicWriter> | undefined;
  const resolvePath = () =>
    (filePath ??= path.join(app.getPath('userData'), fileName));

  return {
    async read(): Promise<string | undefined> {
      if (written !== undefined) return written;
      try {
        return (await fsp.readFile(resolvePath(), 'utf8')).trim();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(`${logTag} Could not read report hash`);
        }
        return undefined;
      }
    },
    write(hash: string): void {
      written = hash;
      writer ??= createDebouncedAtomicWriter({
        filePath: resolvePath(),
        serialize: () => written ?? '',
        onSuccess: () => undefined,
        onError: () => logger.warn(`${logTag} Could not save report hash`),
      });
      writer.schedule();
    },
    async flush(): Promise<void> {
      await writer?.flush();
    },
  };
}
