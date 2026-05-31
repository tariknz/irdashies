import type { CornerNameOverlayConfig } from '@irdashies/types';
import { useSessionVisibility } from '@irdashies/context';
import { useCurrentSection } from './hooks/useCurrentSection';

type CornerNameOverlayProps = Partial<CornerNameOverlayConfig>;

export const CornerNameOverlay = ({
  showCornerNumber = true,
  showProgressBar = true,
  showTrackPct = true,
  fontSize = 18,
  opacity = 0.9,
  sessionVisibility,
}: CornerNameOverlayProps) => {
  const { section, progress, lapDistPct } = useCurrentSection();
  const isSessionVisible = useSessionVisibility(sessionVisibility);

  if (!isSessionVisible) return null;

  if (!section || !section.name) return null;

  return (
    <div
      className="widget-radius-surface w-full rounded-sm p-2 relative overflow-hidden"
      style={{ backgroundColor: `rgba(15, 23, 42, ${opacity})` }}
    >
      {/* Main content */}
      <div className="flex items-center gap-2">
        {/* Corner number badge */}
        {showCornerNumber && section.corner_number && (
          <div className="flex items-center justify-center px-1.5 py-0.5 rounded bg-sky-500/30 border border-sky-400/50">
            <span
              className="text-sky-300 font-bold tabular-nums"
              style={{ fontSize: `${fontSize - 4}px` }}
            >
              {section.corner_number}
            </span>
          </div>
        )}

        {/* Section name */}
        <div className="flex flex-col min-w-0">
          <span
            className="text-white font-semibold leading-tight truncate"
            style={{ fontSize: `${fontSize}px` }}
          >
            {section.name}
          </span>
        </div>

        {/* Track percentage */}
        {showTrackPct && (
          <span
            className="text-slate-400 tabular-nums ml-auto"
            style={{ fontSize: `${fontSize - 4}px` }}
          >
            {Math.round(lapDistPct * 100)}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {showProgressBar && (
        <div className="mt-1.5 h-1 w-full bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-400 rounded-full transition-[width] duration-200 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};
