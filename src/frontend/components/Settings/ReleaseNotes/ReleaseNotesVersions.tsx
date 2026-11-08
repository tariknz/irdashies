import { TagIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { ReleaseNotesSummary } from '@irdashies/types';
import { useReleaseNotesHistory } from './useReleaseNotesHistory';

interface ReleaseNotesVersionsProps {
  currentVersion: string;
  availableVersion: string | null;
  selectedVersion: string;
  onSelect: (version: string) => void;
}

const VERSIONS_PER_BATCH = 5;

export const ReleaseNotesVersions = ({
  currentVersion,
  availableVersion,
  selectedVersion,
  onSelect,
}: ReleaseNotesVersionsProps) => {
  const history = useReleaseNotesHistory();
  const [visibleCount, setVisibleCount] = useState(VERSIONS_PER_BATCH);
  const versions = new Map<string, ReleaseNotesSummary>();
  // Always keep the installed release and downloaded update accessible, even offline.
  for (const version of [availableVersion, currentVersion]) {
    if (version)
      versions.set(version, {
        version,
        title: `irDashies ${version}`,
        publishedAt: null,
      });
  }
  for (const release of history.releases)
    versions.set(release.version, release);
  const releases = [...versions.values()];
  const hasMore = releases.length > visibleCount || history.hasMore;
  const loadMore = () => {
    const nextCount = visibleCount + VERSIONS_PER_BATCH;
    setVisibleCount(nextCount);
    if (nextCount > releases.length && history.hasMore) history.loadMore();
  };

  return (
    <nav
      aria-label="Release versions"
      className="w-36 shrink-0 overflow-y-auto border-r border-settings-boundary pr-3 sm:w-44 sm:pr-4"
    >
      <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Versions
      </h3>
      <ul className="space-y-1">
        {releases.slice(0, visibleCount).map((release) => (
          <li key={release.version}>
            <button
              type="button"
              aria-current={
                selectedVersion === release.version ? 'true' : undefined
              }
              onClick={() => onSelect(release.version)}
              title={release.title}
              className="flex w-full items-start gap-2 rounded-md border border-transparent px-3 py-2.5 text-left text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-accent-300 aria-current:border-accent-500/40 aria-current:bg-accent-500/10 aria-current:text-accent-300"
            >
              <TagIcon size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold">
                  v{release.version}
                </span>{' '}
                {release.version === currentVersion ? (
                  <span className="mt-1 block text-xs text-slate-400">
                    Installed
                  </span>
                ) : release.version === availableVersion ? (
                  <span className="mt-1 block text-xs text-slate-400">
                    Downloaded update
                  </span>
                ) : release.publishedAt ? (
                  <span className="mt-1 block text-xs text-slate-400">
                    {new Date(release.publishedAt).toLocaleDateString()}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {history.loading && (
        <p role="status" className="px-3 py-3 text-xs text-slate-400">
          Loading versions…
        </p>
      )}
      {history.error || history.cached ? (
        <div className="px-3 py-3 text-xs text-slate-400">
          <p>
            {history.error
              ? 'Could not load older versions.'
              : 'Showing saved versions.'}
          </p>
          <button
            type="button"
            onClick={history.retry}
            disabled={history.loading}
            className="mt-2 text-accent-300 hover:underline disabled:opacity-50"
          >
            Retry version list
          </button>
        </div>
      ) : null}
      {hasMore && !history.loading && !history.error && (
        <button
          type="button"
          onClick={loadMore}
          className="mt-3 w-full rounded-md px-3 py-2 text-left text-xs text-accent-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-accent-300"
        >
          Load older versions
        </button>
      )}
    </nav>
  );
};
