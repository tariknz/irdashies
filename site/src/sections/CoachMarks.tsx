import { useState, useCallback, useEffect } from 'react';
import {
  ArrowsOutCardinal,
  ArrowUp,
  CursorClick,
  GearSix,
} from '@phosphor-icons/react';

/**
 * First-visit coach marks overlay — three callouts pointing at the toolbar,
 * a widget, and the configure button. Dismissed on first click anywhere.
 */
export function CoachMarks({ onDismiss }: { onDismiss: () => void }) {
  const [fading, setFading] = useState(false);

  const dismiss = useCallback(() => {
    setFading(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  useEffect(() => {
    const handler = () => dismiss();
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, [dismiss]);

  return (
    <div
      className={[
        'absolute inset-0 z-50 pointer-events-none transition-opacity duration-300',
        fading ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Callout: toolbar toggles — top-left, below toolbar */}
      <div className="absolute top-14 left-16 flex flex-col items-start gap-2 animate-pulse">
        <ArrowUp size={24} className="text-sky-400 ml-5" />
        <div className="bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-md shadow-lg flex items-center gap-2">
          <CursorClick size={18} />
          Click to enable / disable widgets
        </div>
      </div>

      {/* Callout: configure button — top-right, below toolbar */}
      <div className="absolute top-14 right-4 flex flex-col items-end gap-2 animate-pulse">
        <ArrowUp size={24} className="text-sky-400 mr-5" />
        <div className="bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-md shadow-lg flex items-center gap-2">
          <GearSix size={18} />
          Customize widget settings
        </div>
      </div>

      {/* Callout: widget interaction — center of canvas */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 animate-pulse">
        <div className="bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-md shadow-lg flex items-center gap-2">
          <ArrowsOutCardinal size={18} />
          Drag widgets to move, double-click for settings
        </div>
      </div>

      {/* Dismiss hint */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-12 bg-black/50 text-white/80 text-sm uppercase tracking-widest font-semibold px-4 py-1.5 rounded-md">
        Click anywhere to dismiss
      </div>
    </div>
  );
}
