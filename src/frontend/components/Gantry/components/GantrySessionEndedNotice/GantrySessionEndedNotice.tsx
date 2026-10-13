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
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-slate-700/50 text-xs text-slate-300 flex-shrink-0"
    >
      <FlagCheckered size={16} className="text-amber-400 shrink-0" />
      <span className="flex-1 min-w-0">
        Session ended — showing the final results. They clear when the next
        session loads.
      </span>
      <button
        type="button"
        aria-label="Dismiss session ended message"
        onClick={onDismiss}
        className="p-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-400"
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
