import type {
  ReleaseNotes,
  ReleaseNotesResult,
  ReleaseNotesStatus,
} from '@irdashies/types';
import type {
  ReleaseNotesState,
  ReleaseNotesStore,
} from '../storage/releaseNotes';
import {
  RELEASE_NOTES_BODY_LIMIT,
  RELEASE_NOTES_CACHE_LIMIT,
  sanitizeRelease,
} from '../storage/releaseNotes';
import { compareVersions, normalizeVersion } from './version';
import logger from '../logger';

export function advanceInstalledVersion(
  state: ReleaseNotesState,
  current: string
): ReleaseNotesState {
  const upgraded =
    state.lastVersion && compareVersions(current, state.lastVersion) > 0;
  const pendingVersion =
    state.autoShow &&
    (upgraded ||
      (state.lastVersion === current && state.pendingVersion === current))
      ? current
      : null;
  const unreadVersion =
    upgraded ||
    (state.lastVersion === current && state.unreadVersion === current)
      ? current
      : null;
  return { ...state, lastVersion: current, pendingVersion, unreadVersion };
}

const githubUrl = (tag: string) =>
  `https://github.com/tariknz/irdashies/releases/tag/${encodeURIComponent(tag)}`;

export async function fetchGitHubRelease(
  version: string,
  fetcher: typeof fetch = fetch
): Promise<ReleaseNotesResult> {
  try {
    // Fetch the exact release, never /latest: beta, skipped and installed versions differ.
    for (const tag of [`v${version}`, version]) {
      const response = await fetcher(
        `https://api.github.com/repos/tariknz/irdashies/releases/tags/${encodeURIComponent(tag)}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: AbortSignal.timeout(8_000),
          redirect: 'error',
        }
      );
      if (response.status === 404) continue;
      if (!response.ok) return { status: 'unavailable', reason: 'offline' };
      const length = Number(response.headers.get('content-length'));
      if (length > 1_000_000) throw new Error('Release response too large');
      // Bound the streamed body too: Content-Length is optional and can be compressed.
      if (!response.body) throw new Error('Missing response body');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1_000_000) throw new Error('Release response too large');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const raw: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!raw || typeof raw !== 'object') throw new Error('Invalid release');
      const release = raw as Record<string, unknown>;
      if (
        release.draft === true ||
        normalizeVersion(release.tag_name) !== version
      ) {
        return { status: 'unavailable', reason: 'not-found' };
      }
      const body = release.body === null ? '' : release.body;
      if (typeof body !== 'string' || body.length > RELEASE_NOTES_BODY_LIMIT)
        throw new Error('Invalid release notes');
      const parsed = sanitizeRelease({
        version,
        body,
        title:
          typeof release.name === 'string'
            ? release.name
            : `irDashies ${version}`,
        url: githubUrl(String(release.tag_name)),
        publishedAt: release.published_at,
      });
      if (!parsed) throw new Error('Invalid release notes');
      return { status: 'ready', release: parsed, cached: false };
    }
    return { status: 'unavailable', reason: 'not-found' };
  } catch {
    logger.warn('[ReleaseNotes] Could not fetch release notes for', version);
    return { status: 'unavailable', reason: 'offline' };
  }
}

export function createReleaseNotesService(options: {
  store: ReleaseNotesStore;
  currentVersion: string;
  development: boolean;
  previousVersion?: string;
  fixture?: (version: string) => ReleaseNotes;
  simulation?: boolean;
  fetchRelease?: (version: string) => Promise<ReleaseNotesResult>;
}) {
  const currentVersion = normalizeVersion(options.currentVersion);
  if (!currentVersion) throw new Error('Invalid installed version');
  let state: ReleaseNotesState;
  let availableVersion: string | null = null;
  const inFlight = new Map<string, Promise<ReleaseNotesResult>>();
  const refreshedAt = new Map<string, number>();
  const REFRESH_INTERVAL_MS = 5 * 60_000;
  // Start at app launch, even if the user never opens Settings on this version.
  const ready = options.store.load().then((loaded) => {
    if (!loaded.lastVersion && options.previousVersion) {
      loaded = {
        ...loaded,
        lastVersion: normalizeVersion(options.previousVersion),
      };
    }
    state = advanceInstalledVersion(loaded, currentVersion);
    options.store.save(state);
  });
  const save = () => options.store.save(state);
  return {
    ready,
    setAvailableVersion(version: unknown) {
      const normalized = normalizeVersion(version);
      if (normalized && compareVersions(normalized, currentVersion) > 0)
        availableVersion = normalized;
    },
    async getStatus(): Promise<ReleaseNotesStatus> {
      await ready;
      return {
        currentVersion,
        availableVersion,
        pendingVersion: state.pendingVersion,
        unreadVersion: state.unreadVersion,
        autoShow: state.autoShow,
        development: options.development,
        simulation: options.simulation ?? false,
      };
    },
    async getRelease(raw: unknown): Promise<ReleaseNotesResult> {
      await ready;
      const version = normalizeVersion(raw);
      // Renderer cannot turn the bridge into an arbitrary release scraper.
      if (
        !version ||
        (version !== currentVersion && version !== availableVersion)
      )
        throw new Error('Invalid release version');
      if (options.fixture)
        return {
          status: 'ready',
          release: options.fixture(version),
          cached: false,
        };
      const cached = state.cache.find((entry) => entry.version === version);
      // Serve saved notes immediately, including offline. Refresh in the
      // background at most once per five minutes; concurrent consumers share work.
      const previousRefresh = refreshedAt.get(version);
      if (
        cached &&
        previousRefresh !== undefined &&
        Date.now() - previousRefresh < REFRESH_INTERVAL_MS
      ) {
        return { status: 'ready', release: cached, cached: true };
      }
      let task = inFlight.get(version);
      if (!task) {
        task = (async (): Promise<ReleaseNotesResult> => {
          refreshedAt.set(version, Date.now());
          let result: ReleaseNotesResult;
          try {
            result = await (options.fetchRelease ?? fetchGitHubRelease)(
              version
            );
          } catch {
            result = { status: 'unavailable', reason: 'offline' };
          }
          if (result.status === 'ready') {
            state = {
              ...state,
              cache: [
                result.release,
                ...state.cache.filter((entry) => entry.version !== version),
              ].slice(0, RELEASE_NOTES_CACHE_LIMIT),
            };
            save();
            return result;
          }
          if (cached) return { status: 'ready', release: cached, cached: true };
          return result;
        })();
        inFlight.set(version, task);
        void task.finally(() => inFlight.delete(version));
      }
      if (cached) return { status: 'ready', release: cached, cached: true };
      return task;
    },
    async dismiss(raw: unknown) {
      await ready;
      if (normalizeVersion(raw) !== currentVersion)
        throw new Error('Invalid release version');
      state = { ...state, pendingVersion: null, unreadVersion: null };
      save();
    },
    async setAutoShow(enabled: unknown) {
      await ready;
      if (typeof enabled !== 'boolean')
        throw new Error('Invalid release notes preference');
      state = {
        ...state,
        autoShow: enabled,
        pendingVersion: enabled ? state.pendingVersion : null,
      };
      save();
    },
  };
}
