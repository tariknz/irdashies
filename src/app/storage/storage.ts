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
export const writeDataAsync = async (
  key: string,
  value: unknown,
  filePath: string = FILEPATH
) => {
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

const parseDataAsync = async (filePath: string): Promise<Contents> => {
  const defaultData: Contents = {};
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(data);
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
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Failed to read config file', error);
    logger.warn('Creating new config file');
    return defaultData;
  }
};
