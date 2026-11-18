import { useCallback, useEffect, useState } from 'react';
import type { ReleaseNotesSummary } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

export function useReleaseNotesHistory() {
  const [releases, setReleases] = useState<ReleaseNotesSummary[]>([]);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cached, setCached] = useState(false);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const loadMore = useCallback(() => setPage((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const load = async () => {
      try {
        const result = await window.releaseNotesBridge?.getReleases(page);
        if (!active) return;
        if (result?.status !== 'ready') {
          setError(true);
          return;
        }
        setReleases((previous) => {
          const merged = new Map(
            (page === 1 ? [] : previous).map((entry) => [entry.version, entry])
          );
          for (const release of result.releases)
            merged.set(release.version, release);
          return [...merged.values()];
        });
        setHasMore(result.hasMore);
        setCached(result.cached);
      } catch (error) {
        logger.warn('Failed to load release history', error);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [page, attempt]);

  return { releases, loading, error, hasMore, cached, loadMore, retry };
}
