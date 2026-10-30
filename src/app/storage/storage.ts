import { app } from 'electron';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import logger from '../logger';

const dataPath = app.getPath('userData');
const FILEPATH = path.join(dataPath, 'config.json');

type Contents = Record<string, unknown>;

// Latest known contents per file, so a stale disk snapshot never overwrites a
// newer value written by another writer. Writes are serialized per file.
const cache = new Map<string, Contents>();
const writeQueue = new Map<string, Promise<void>>();
// writeDataAsync calls that have not finished yet, including ones still
// reading the file and so not yet in writeQueue.
const pendingAsyncWrites = new Set<Promise<void>>();

const persist = (filePath: string): Promise<void> => {
  const previous = writeQueue.get(filePath) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() =>
      fsp.writeFile(filePath, JSON.stringify(cache.get(filePath)), 'utf8')
    );
  const tail = next.catch(() => undefined);
  writeQueue.set(filePath, tail);
  void tail.then(() => {
    if (writeQueue.get(filePath) === tail) writeQueue.delete(filePath);
  });
  return next;
};

export const writeData = (
  key: string,
  value: unknown,
  filePath: string = FILEPATH
) => {
  const contents = cache.get(filePath) ?? parseData(filePath);
  contents[key] = value;
  cache.set(filePath, contents);
  fs.writeFileSync(filePath, JSON.stringify(contents));
  // An async write still in flight may land after this one with older data;
  // queue a rewrite of the latest contents behind it.
  if (writeQueue.has(filePath)) {
    persist(filePath).catch((error) =>
      logger.warn('Failed to rewrite config file', error)
    );
  }
};

/**
 * Async counterpart of writeData for writes that are not on a startup path.
 * Writes to the same file are serialized and always persist the latest
 * contents, so only `key` changes.
 */
export const writeDataAsync = (
  key: string,
  value: unknown,
  filePath: string = FILEPATH
): Promise<void> => {
  const pending = writeDataAsyncInner(key, value, filePath);
  const tracked = pending.catch(() => undefined);
  pendingAsyncWrites.add(tracked);
  void tracked.then(() => pendingAsyncWrites.delete(tracked));
  return pending;
};

/**
 * Resolves once every writeDataAsync started so far has reached disk. Call on
 * shutdown so the process cannot exit while config.json is mid-write.
 */
export const flushStorageWritesOnShutdown = async (): Promise<void> => {
  while (pendingAsyncWrites.size > 0) {
    await Promise.all([...pendingAsyncWrites]);
  }
  await Promise.all([...writeQueue.values()]);
};

const writeDataAsyncInner = async (
  key: string,
  value: unknown,
  filePath: string
): Promise<void> => {
  const loaded = cache.has(filePath)
    ? undefined
    : await parseDataAsync(filePath);
  // Re-check after the await: another writer may have populated the cache.
  const contents = cache.get(filePath) ?? loaded ?? {};
  contents[key] = value;
  cache.set(filePath, contents);
  await persist(filePath);
};

export const readData = <T>(
  key: string,
  filePath: string = FILEPATH
): T | undefined => {
  const contents = cache.get(filePath) ?? parseData(filePath);
  return contents[key] as T;
};

const toContents = (raw: unknown): Contents => {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Contents;
  }
  logger.warn('Config file does not contain an object');
  return {};
};

const parseDataAsync = async (filePath: string): Promise<Contents> => {
  const defaultData: Contents = {};
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    return toContents(JSON.parse(data));
  } catch (error) {
    logger.warn('Failed to read config file', error);
    logger.warn('Creating new config file');
    return defaultData;
  }
};

const parseData = (filePath: string): Contents => {
  const defaultData: Contents = {};
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return toContents(JSON.parse(data));
  } catch (error) {
    logger.warn('Failed to read config file', error);
    logger.warn('Creating new config file');
    return defaultData;
  }
};
