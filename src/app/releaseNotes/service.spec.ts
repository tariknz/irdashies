import { describe, it, expect, vi } from 'vitest';
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));
import {
  advanceInstalledVersion,
  createReleaseNotesService,
  fetchGitHubRelease,
} from './service';
import { compareVersions, normalizeVersion } from './version';
import {
  defaultReleaseNotesState,
  type ReleaseNotesStore,
  type ReleaseNotesState,
} from '../storage/releaseNotes';
import { releaseNotesFixture } from '../../types/releaseNotesFixture';

function memoryStore(initial = defaultReleaseNotesState()): ReleaseNotesStore {
  let state = structuredClone(initial);
  return {
    load: async () => structuredClone(state),
    save: (next) => {
      state = structuredClone(next);
    },
    flush: async () => undefined,
  };
}
const makeService = (
  store: ReleaseNotesStore,
  extra: Partial<Parameters<typeof createReleaseNotesService>[0]> = {}
) =>
  createReleaseNotesService({
    store,
    currentVersion: '2.1.0',
    development: true,
    ...extra,
  });
const upgraded = (): ReleaseNotesState => ({
  ...defaultReleaseNotesState(),
  lastVersion: '2.0.0',
});

describe('release note version selection', () => {
  it.each(['2.1.0', 'v2.1.0', '2.1.0+build.42'])(
    'normalizes %s to installed release version',
    (value) => {
      expect(normalizeVersion(value)).toBe('2.1.0');
    }
  );
  it.each(['latest', '../2.1.0', '2.01.0', '2.1.0-01', '', undefined, 3])(
    'rejects invalid version %s',
    (value) => {
      expect(normalizeVersion(value)).toBeNull();
    }
  );
  it('compares prereleases and multi-digit versions using SemVer order', () => {
    expect(compareVersions('2.10.0', '2.9.0')).toBe(1);
    expect(compareVersions('2.1.0', '2.1.0-beta.10')).toBe(1);
    expect(compareVersions('2.1.0-beta.10', '2.1.0-beta.2')).toBe(1);
    expect(compareVersions('2.1.0-1', '2.1.0-alpha')).toBe(-1);
    expect(compareVersions('2.1.0+one', '2.1.0+two')).toBe(0);
  });
});

describe('upgrade lifecycle', () => {
  it('does not show on first install, unchanged version or downgrade', () => {
    for (const previous of [null, '2.1.0', '2.2.0']) {
      const state = advanceInstalledVersion(
        { ...defaultReleaseNotesState(), lastVersion: previous },
        '2.1.0'
      );
      expect(state.lastVersion).toBe('2.1.0');
      expect(state.pendingVersion).toBeNull();
    }
  });
  it('records version at startup without waiting for Settings', async () => {
    const store = memoryStore(upgraded());
    await makeService(store).ready;
    expect(await store.load()).toMatchObject({
      lastVersion: '2.1.0',
      pendingVersion: '2.1.0',
    });
  });
  it('keeps an upgrade pending across restarts until explicitly dismissed', async () => {
    const store = memoryStore(upgraded());
    const first = makeService(store);
    expect(await first.getStatus()).toMatchObject({ pendingVersion: '2.1.0' });
    const restarted = makeService(store);
    expect((await restarted.getStatus()).pendingVersion).toBe('2.1.0');
    await restarted.dismiss('v2.1.0');
    expect((await makeService(store).getStatus()).pendingVersion).toBeNull();
  });
  it('does not regress a v-prefixed or metadata version into a new upgrade', async () => {
    const store = memoryStore({
      ...defaultReleaseNotesState(),
      lastVersion: '2.1.0',
    });
    expect(
      (
        await makeService(store, {
          currentVersion: 'v2.1.0+build.2',
        }).getStatus()
      ).pendingVersion
    ).toBeNull();
  });
  it('suppresses pending and future updates while disabled; enabling does not revive them', async () => {
    const store = memoryStore(upgraded());
    const service = makeService(store);
    await service.setAutoShow(false);
    expect((await service.getStatus()).pendingVersion).toBeNull();
    const next = makeService(store, { currentVersion: '2.2.0' });
    expect((await next.getStatus()).pendingVersion).toBeNull();
    await next.setAutoShow(true);
    expect((await next.getStatus()).pendingVersion).toBeNull();
  });
  it('keeps unread update independent of auto-show and clears it when viewed', async () => {
    const store = memoryStore({ ...upgraded(), autoShow: false });
    const service = makeService(store);
    expect(await service.getStatus()).toMatchObject({
      pendingVersion: null,
      unreadVersion: '2.1.0',
    });
    const restarted = makeService(store);
    expect((await restarted.getStatus()).unreadVersion).toBe('2.1.0');
    await restarted.setAutoShow(true);
    expect(await restarted.getStatus()).toMatchObject({
      pendingVersion: null,
      unreadVersion: '2.1.0',
    });
    await restarted.dismiss('2.1.0');
    expect(await makeService(store).getStatus()).toMatchObject({
      pendingVersion: null,
      unreadVersion: null,
    });
  });
  it('disabling the popup retains the unread badge; unchanged installs and downgrades do not create it', async () => {
    const store = memoryStore(upgraded());
    const service = makeService(store);
    await service.setAutoShow(false);
    expect(await service.getStatus()).toMatchObject({
      pendingVersion: null,
      unreadVersion: '2.1.0',
    });
    const downgraded = makeService(store, { currentVersion: '2.0.0' });
    expect((await downgraded.getStatus()).unreadVersion).toBeNull();
    expect(
      (await makeService(memoryStore()).getStatus()).unreadVersion
    ).toBeNull();
    expect(
      (
        await makeService(
          memoryStore({ ...defaultReleaseNotesState(), lastVersion: '2.1.0' })
        ).getStatus()
      ).unreadVersion
    ).toBeNull();
  });
  it('seeds previous only for a fresh isolated simulation', async () => {
    const store = memoryStore();
    expect(
      (await makeService(store, { previousVersion: '2.0.0' }).getStatus())
        .pendingVersion
    ).toBe('2.1.0');
    await makeService(store).dismiss('2.1.0');
    expect(
      (await makeService(store, { previousVersion: '2.0.0' }).getStatus())
        .pendingVersion
    ).toBeNull();
  });
  it('validates IPC values and only accepts installed or known downloaded version', async () => {
    const service = makeService(memoryStore(), {
      fixture: releaseNotesFixture,
    });
    await expect(service.getRelease('9.0.0')).rejects.toThrow();
    await expect(service.dismiss('9.0.0')).rejects.toThrow();
    await expect(service.setAutoShow('yes')).rejects.toThrow();
    service.setAvailableVersion('https://example.com/2.2.0');
    expect((await service.getStatus()).availableVersion).toBeNull();
    service.setAvailableVersion('v2.2.0');
    expect((await service.getRelease('2.2.0')).status).toBe('ready');
  });
});

describe('GitHub fetching and offline cache', () => {
  const releaseResponse = (extra = {}) =>
    Response.json({
      tag_name: 'v2.1.0',
      name: 'Release 2.1.0',
      body: '## Changes\n\nNotes',
      draft: false,
      published_at: '2026-10-18T00:00:00Z',
      ...extra,
    });
  it('requests exact version and tries unprefixed tags after 404', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(releaseResponse({ tag_name: '2.1.0' }));
    expect(await fetchGitHubRelease('2.1.0', fetcher)).toMatchObject({
      status: 'ready',
      release: { version: '2.1.0' },
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.github.com/repos/tariknz/irdashies/releases/tags/v2.1.0',
      'https://api.github.com/repos/tariknz/irdashies/releases/tags/2.1.0',
    ]);
  });
  it.each([{ draft: true }, { tag_name: 'v2.2.0' }])(
    'rejects unpublished or mismatched responses',
    async (extra) => {
      expect(
        await fetchGitHubRelease(
          '2.1.0',
          vi.fn<typeof fetch>().mockResolvedValue(releaseResponse(extra))
        )
      ).toMatchObject({ status: 'unavailable', reason: 'not-found' });
    }
  );
  it('preserves empty release notes and handles missing releases', async () => {
    expect(
      await fetchGitHubRelease(
        '2.1.0',
        vi.fn<typeof fetch>().mockResolvedValue(releaseResponse({ body: null }))
      )
    ).toMatchObject({ status: 'ready', release: { body: '' } });
    expect(
      await fetchGitHubRelease(
        '2.1.0',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('', { status: 404 }))
      )
    ).toEqual({ status: 'unavailable', reason: 'not-found' });
  });
  it.each([429, 500])(
    'handles GitHub status %s as a recoverable failure',
    async (status) => {
      expect(
        await fetchGitHubRelease(
          '2.1.0',
          vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))
        )
      ).toEqual({ status: 'unavailable', reason: 'offline' });
    }
  );
  it('handles network errors, malformed JSON and oversized streamed responses', async () => {
    for (const fetcher of [
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{')),
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('x'.repeat(1_000_001))),
    ])
      expect(await fetchGitHubRelease('2.1.0', fetcher)).toEqual({
        status: 'unavailable',
        reason: 'offline',
      });
  });
  it('returns cached notes immediately while refresh is unavailable; caps saved releases', async () => {
    const store = memoryStore({
      ...upgraded(),
      cache: [releaseNotesFixture()],
    });
    const fetchRelease = vi
      .fn()
      .mockResolvedValue({ status: 'unavailable', reason: 'offline' });
    const service = makeService(store, { fetchRelease });
    expect(await service.getRelease('2.1.0')).toMatchObject({
      status: 'ready',
      cached: true,
    });
    expect(await service.getRelease('2.1.0')).toMatchObject({
      status: 'ready',
      cached: true,
    });
    expect(fetchRelease).toHaveBeenCalledTimes(1);
  });
  it('deduplicates fetches, reuses successful results and leaves failures pending for retry', async () => {
    const fetchRelease = vi
      .fn()
      .mockResolvedValueOnce({ status: 'unavailable', reason: 'offline' })
      .mockResolvedValue({
        status: 'ready',
        release: releaseNotesFixture(),
        cached: false,
      });
    const service = makeService(memoryStore(upgraded()), { fetchRelease });
    expect((await service.getRelease('2.1.0')).status).toBe('unavailable');
    expect((await service.getStatus()).pendingVersion).toBe('2.1.0');
    const results = await Promise.all([
      service.getRelease('2.1.0'),
      service.getRelease('2.1.0'),
    ]);
    expect(results.every((result) => result.status === 'ready')).toBe(true);
    await service.getRelease('2.1.0');
    expect(fetchRelease).toHaveBeenCalledTimes(2);
  });
});
