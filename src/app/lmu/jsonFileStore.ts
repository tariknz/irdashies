import fsp from 'node:fs/promises';
import { createDebouncedAtomicWriter } from '../storage/debouncedAtomicWriter';

export interface JsonFileStoreLogger {
  warn: (message: string) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const openStores = new Set<JsonFileStore>();

export function flushJsonFileStoresOnShutdown(): Promise<void> {
  return Promise.all([...openStores].map((store) => store.flush())).then(
    () => undefined
  );
}

export class JsonFileStore {
  private data: Record<string, unknown> = {};
  private readonly writer: ReturnType<typeof createDebouncedAtomicWriter>;

  constructor(
    private readonly filePath: string,
    private readonly log: JsonFileStoreLogger = { warn: () => undefined }
  ) {
    this.writer = createDebouncedAtomicWriter({
      filePath,
      serialize: () => JSON.stringify(this.data),
      onSuccess: () => undefined,
      onError: (error) =>
        this.log.warn(`Failed to write ${filePath}: ${String(error)}`),
    });
    openStores.add(this);
  }

  async restore(): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(
        await fsp.readFile(this.filePath, 'utf8')
      );
      this.data = isRecord(parsed) ? parsed : {};
    } catch (error) {
      this.data = {};
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        this.log.warn(`Failed to read ${this.filePath}: ${String(error)}`);
      }
    }
  }

  get(key: string): unknown {
    return this.data[key];
  }

  entries(): [string, unknown][] {
    return Object.entries(this.data);
  }

  set(key: string, value: unknown): void {
    this.data[key] = value;
    this.writer.schedule();
  }

  replaceAll(data: Record<string, unknown>): void {
    this.data = data;
    this.writer.schedule();
  }

  flush(): Promise<void> {
    return this.writer.flush();
  }

  async close(): Promise<void> {
    await this.writer.flush();
    openStores.delete(this);
  }
}
