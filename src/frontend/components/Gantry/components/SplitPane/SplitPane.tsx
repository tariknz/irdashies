import {
  memo,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** Accessible name for the divider, e.g. "Standings and incidents split". */
  label: string;
  /** localStorage key the ratio is remembered under. Omit to forget it. */
  storageKey?: string;
  /** Percentage of the width the left pane starts at. */
  defaultPercent?: number;
  /** Narrowest either pane is allowed to get, as a percentage. */
  minPercent?: number;
}

const KEY_STEP_PERCENT = 2;

const clampPercent = (value: number, min: number): number =>
  Math.min(100 - min, Math.max(min, value));

const readStored = (key: string | undefined): number | null => {
  if (!key) return null;
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Two panes with a divider the user can drag. The ratio is a UI preference, so
 * it lives in localStorage rather than the dashboard config.
 */
export const SplitPane = memo(
  ({
    left,
    right,
    label,
    storageKey,
    defaultPercent = 50,
    minPercent = 15,
  }: SplitPaneProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [percent, setPercent] = useState(() =>
      clampPercent(readStored(storageKey) ?? defaultPercent, minPercent)
    );
    const draggingRef = useRef(false);
    // Only the pointer that started the drag may move or end it. A second
    // finger landing on the divider would otherwise steer it or drop it.
    const pointerIdRef = useRef<number | null>(null);
    // Tracks the latest ratio outside of React state so pointerup can persist
    // it even if the last pointermove's setState hasn't committed yet.
    const percentRef = useRef(percent);

    const endDrag = useCallback(() => {
      draggingRef.current = false;
      pointerIdRef.current = null;
    }, []);

    const remember = useCallback(
      (value: number) => {
        if (storageKey) localStorage.setItem(storageKey, String(value));
      },
      [storageKey]
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        // Only the primary button drags. A right-press that ends in a context
        // menu never delivers pointerup, which would latch the drag on.
        if (event.button !== 0 || !event.isPrimary) return;
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = true;
        pointerIdRef.current = event.pointerId;
      },
      []
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const element = containerRef.current;
        if (
          !draggingRef.current ||
          pointerIdRef.current !== event.pointerId ||
          !element
        ) {
          return;
        }
        if (event.buttons === 0) {
          endDrag();
          return;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0) return;
        const next = clampPercent(
          ((event.clientX - rect.left) / rect.width) * 100,
          minPercent
        );
        percentRef.current = next;
        setPercent(next);
      },
      [minPercent, endDrag]
    );

    const handlePointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current || pointerIdRef.current !== event.pointerId) {
          return;
        }
        endDrag();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        remember(percentRef.current);
      },
      [remember, endDrag]
    );

    const nudge = useCallback(
      (delta: number) => {
        setPercent((current) => {
          const next = clampPercent(current + delta, minPercent);
          percentRef.current = next;
          remember(next);
          return next;
        });
      },
      [minPercent, remember]
    );

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          nudge(-KEY_STEP_PERCENT);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          nudge(KEY_STEP_PERCENT);
        } else if (event.key === 'Home') {
          event.preventDefault();
          const reset = clampPercent(defaultPercent, minPercent);
          percentRef.current = reset;
          setPercent(reset);
          remember(reset);
        }
      },
      [nudge, defaultPercent, minPercent, remember]
    );

    const handleDoubleClick = useCallback(() => {
      const reset = clampPercent(defaultPercent, minPercent);
      percentRef.current = reset;
      setPercent(reset);
      remember(reset);
    }, [defaultPercent, minPercent, remember]);

    return (
      <div ref={containerRef} className="relative flex flex-1 overflow-hidden">
        <div
          className="overflow-hidden shrink-0 grow-0"
          style={{ flexBasis: `${percent}%` }}
        >
          {left}
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={label}
          aria-valuenow={Math.round(percent)}
          aria-valuemin={minPercent}
          aria-valuemax={100 - minPercent}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
          onKeyDown={handleKeyDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize. Double-click to reset."
          // Taken out of flex flow so the panes split exactly percent /
          // (100 - percent) of the container, not of container-minus-divider.
          className="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 z-10 cursor-col-resize touch-none select-none bg-slate-700/50 hover:bg-sky-500/70 focus:outline-none focus:bg-sky-500/70"
          style={{ left: `${percent}%` }}
        />
        <div className="flex-1 min-w-0 overflow-hidden">{right}</div>
      </div>
    );
  }
);
SplitPane.displayName = 'SplitPane';
