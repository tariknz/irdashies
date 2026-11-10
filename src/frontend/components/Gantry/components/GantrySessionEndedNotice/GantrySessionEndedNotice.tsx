import { t } from '@irdashies/frontend/i18n';
import { memo, useState } from 'react';
import { FlagCheckered, X } from '@phosphor-icons/react';
import { useGantrySessionHold } from '../../hooks/useGantrySessionHold';

interface GantrySessionEndedBannerProps {
  onDismiss: () => void;
}

export const GantrySessionEndedBanner = memo(
  ({ onDismiss }: GantrySessionEndedBannerProps) => (
    <div
      role="status"
      className="settings-shell flex items-center gap-2 px-4 py-1.5 bg-slate-800 border-b border-slate-700 text-sm text-slate-300 shrink-0"
    >
      <FlagCheckered size={16} className="text-amber-400 shrink-0" />
      <span className="flex-1 min-w-0">
        {t(
          'Session ended — showing the final results. They clear when the next session loads.'
        )}
      </span>
      <button
        type="button"
        aria-label={t('Dismiss session ended message')}
        onClick={onDismiss}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
      >
        <X size={14} />
      </button>
    </div>
  )
);
GantrySessionEndedBanner.displayName = 'GantrySessionEndedBanner';

/**
 * Shows the banner while the Gantry is holding a finished session. Dismissing
 * hides it until the next hold.
 */
export const GantrySessionEndedNotice = () => {
  const { holding, epoch } = useGantrySessionHold();
  const [dismissedEpoch, setDismissedEpoch] = useState<number | null>(null);
  if (!holding || dismissedEpoch === epoch) return null;
  return (
    <GantrySessionEndedBanner onDismiss={() => setDismissedEpoch(epoch)} />
  );
};
