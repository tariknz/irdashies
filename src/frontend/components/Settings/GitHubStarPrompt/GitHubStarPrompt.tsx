import { StarIcon } from '@phosphor-icons/react';
import { useRunningState } from '@irdashies/context';
import { useGitHubStarPrompt } from './useGitHubStarPrompt';

interface GitHubStarNoticeProps {
  onDismiss: () => void;
}

export const GitHubStarNotice = ({ onDismiss }: GitHubStarNoticeProps) => (
  <aside
    aria-label="Support irDashies"
    className="fixed top-24 right-4 z-40 flex w-[min(22.5rem,calc(100vw-2rem))] flex-col gap-2 rounded-lg border border-white/10 bg-slate-950/90 px-3.5 py-2.5 text-sm text-slate-100 shadow-xl shadow-black/25 backdrop-blur-2xl backdrop-saturate-110 [-webkit-app-region:no-drag] sm:right-8"
  >
    <div className="flex min-w-0 flex-col gap-0.5" role="status">
      <div className="flex items-center gap-2">
        <StarIcon
          aria-hidden="true"
          size={16}
          className="shrink-0 text-amber-400"
        />
        <h2 className="font-medium">Enjoying irDashies?</h2>
      </div>
      <p className="text-slate-400">Help more people discover it.</p>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex h-6 cursor-pointer items-center justify-center rounded-lg border border-transparent px-2 font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-accent-300"
      >
        Dismiss
      </button>
      <a
        href="https://github.com/tariknz/irdashies"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onDismiss}
        className="inline-flex h-6 shrink-0 items-center justify-center rounded-lg border border-accent-600 bg-accent-600 px-2 font-medium text-on-accent shadow-xs inset-shadow-[0_1px_rgb(255_255_255/16%)] transition-colors hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-accent-300"
      >
        Star on GitHub
      </a>
    </div>
  </aside>
);

/** Settings only: never render a support request over a simulator session. */
export const GitHubStarPrompt = () => {
  const { running } = useRunningState();
  const { visible, dismiss } = useGitHubStarPrompt(running);
  return visible ? <GitHubStarNotice onDismiss={dismiss} /> : null;
};
