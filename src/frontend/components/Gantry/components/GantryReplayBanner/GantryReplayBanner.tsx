import { t } from '@irdashies/frontend/i18n';
import { memo, useState } from 'react';
import { FilmStrip, Info, X } from '@phosphor-icons/react';
import { useReplayContextSnapshot } from '@irdashies/context';

export type GantryReplayBannerProvenance =
  'archived' | 'localNotArchived' | 'foreign';

interface GantryReplayBannerProps {
  provenance: GantryReplayBannerProvenance;
  onDismiss: () => void;
}

const MESSAGES: Record<GantryReplayBannerProvenance, string> = {
  archived: 'Replay — showing events recorded on this PC during the session.',
  localNotArchived:
    "irDashies wasn't recording when this session ran, so there is no event log for this replay. Standings still follow the replay.",
  foreign:
    'This replay was recorded on another computer. Event history is only available for sessions irDashies recorded on this PC. Standings still follow the replay.',
};

export const GantryReplayBanner = memo(
  ({ provenance, onDismiss }: GantryReplayBannerProps) => {
    const Icon = provenance === 'archived' ? FilmStrip : Info;
    return (
      <div
        role="status"
        className="settings-shell flex items-center gap-2 px-4 py-1.5 bg-slate-800 border-b border-slate-700 text-sm text-slate-300 shrink-0"
      >
        <Icon size={16} className="text-amber-400 shrink-0" />
        <span className="flex-1 min-w-0">{t(MESSAGES[provenance])}</span>
        <button
          type="button"
          aria-label={t('Dismiss replay message')}
          onClick={onDismiss}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
        >
          <X size={14} />
        </button>
      </div>
    );
  }
);
GantryReplayBanner.displayName = 'GantryReplayBanner';

/**
 * Shows the banner while a replay file is loaded. Dismissing hides it until
 * the replay context changes, which happens when the next replay loads.
 */
export const GantryReplayNotice = () => {
  const { mode, provenance, version } = useReplayContextSnapshot();
  const [dismissedVersion, setDismissedVersion] = useState<number | null>(null);
  if (mode !== 'replayFile' || provenance === 'none') return null;
  if (dismissedVersion === version) return null;
  return (
    <GantryReplayBanner
      provenance={provenance}
      onDismiss={() => setDismissedVersion(version)}
    />
  );
};
