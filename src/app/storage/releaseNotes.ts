import * as fsp from 'node:fs/promises';
import path from 'node:path';
import type { ReleaseNotes } from '@irdashies/types';
import { normalizeVersion } from '../releaseNotes/version';
import logger from '../logger';

export const RELEASE_NOTES_CACHE_LIMIT = 5;
export const RELEASE_NOTES_BODY_LIMIT = 200_000;
export interface ReleaseNotesState {
  lastVersion: string | null;
  pendingVersion: string | null;
  unreadVersion: string | null;
  autoShow: boolean;
  cache: ReleaseNotes[];
}
export const defaultReleaseNotesState = (): ReleaseNotesState => ({
  lastVersion: null,
  pendingVersion: null,
  unreadVersion: null,
  autoShow: true,
  cache: [],
});

export function sanitizeRelease(value: unknown): ReleaseNotes | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ReleaseNotes>;
  const version = normalizeVersion(raw.version);
  if (
    !version ||
    typeof raw.body !== 'string' ||
    raw.body.length > RELEASE_NOTES_BODY_LIMIT ||
    typeof raw.title !== 'string' ||
    raw.title.length > 500 ||
    typeof raw.url !== 'string'
  )
    return null;
  // Cache and GitHub data cannot inject arbitrary links into View on GitHub.
  const expected = 'https://github.com/tariknz/irdashies/releases/tag/';
  if (!raw.url.startsWith(expected)) return null;
  const tag = decodeURIComponent(raw.url.slice(expected.length));
  if (normalizeVersion(tag) !== version) return null;
  return {
    version,
    title: raw.title,
    body: raw.body,
    url: raw.url,
    publishedAt:
      typeof raw.publishedAt === 'string' &&
      !Number.isNaN(Date.parse(raw.publishedAt))
        ? raw.publishedAt
        : null,
  };
}

export interface ReleaseNotesStore {
  load(): Promise<ReleaseNotesState>;
  save(state: ReleaseNotesState): void;
  flush(): Promise<void>;
}

export function createReleaseNotesStore(filePath: string): ReleaseNotesStore {
  const describeError = (error: unknown) =>
    error instanceof Error
      ? error.message.replaceAll(filePath, path.basename(filePath))
      : String(error);
  let state = defaultReleaseNotesState();
  let loaded: Promise<ReleaseNotesState> | undefined;
  let timer: NodeJS.Timeout | undefined;
  let dirty = false;
  let writes = Promise.resolve();
  const load = () =>
    (loaded ??= (async () => {
      try {
        // State is capped on write; refuse an unexpectedly large file on read.
        if ((await fsp.stat(filePath)).size > 5_000_000)
          throw new Error('File too large');
        const parsed: unknown = JSON.parse(
          await fsp.readFile(filePath, 'utf8')
        );
        if (!parsed || typeof parsed !== 'object')
          throw new Error('Invalid shape');
        const raw = parsed as Partial<ReleaseNotesState>;
        state = {
          lastVersion: normalizeVersion(raw.lastVersion),
          pendingVersion: normalizeVersion(raw.pendingVersion),
          unreadVersion:
            normalizeVersion(raw.unreadVersion) ??
            normalizeVersion(raw.pendingVersion),
          autoShow: typeof raw.autoShow === 'boolean' ? raw.autoShow : true,
          cache: Array.isArray(raw.cache)
            ? raw.cache
                .slice(0, RELEASE_NOTES_CACHE_LIMIT)
                .map((entry) => {
                  try {
                    return sanitizeRelease(entry);
                  } catch {
                    return null;
                  }
                })
                .filter((entry): entry is ReleaseNotes => entry !== null)
            : [],
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(
            '[ReleaseNotes] Failed to read release notes state',
            path.basename(filePath),
            describeError(error)
          );
        }
      }
      return state;
    })());
  const write = async () => {
    if (!dirty) return;
    dirty = false;
    const payload = JSON.stringify(state);
    const temp = `${filePath}.${process.pid}.tmp`;
    try {
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(temp, payload, 'utf8');
      await fsp.rename(temp, filePath);
    } catch (error) {
      logger.warn(
        '[ReleaseNotes] Failed to save release notes state',
        path.basename(filePath),
        describeError(error)
      );
      await fsp.unlink(temp).catch(() => undefined);
    }
  };
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    writes = writes.then(write);
    return writes;
  };
  return {
    load,
    save(next) {
      state = {
        ...next,
        cache: next.cache.slice(0, RELEASE_NOTES_CACHE_LIMIT),
      };
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), 250);
    },
    flush,
  };
}
