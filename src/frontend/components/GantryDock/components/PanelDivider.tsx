import {
  memo,
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const KEY_STEP_PERCENT = 2;

export interface PanelDividerProps {
  index: number;
  label: string;
  position: number;
  min: number;
  max: number;
  onDragStart: () => void;
  onDrag: (index: number, deltaPx: number) => void;
  onDragEnd: () => void;
  onNudge: (index: number, deltaPercent: number) => void;
  onReset: () => void;
}

export const PanelDivider = memo(
  ({
    index,
    label,
    position,
    min,
    max,
    onDragStart,
    onDrag,
    onDragEnd,
    onNudge,
    onReset,
  }: PanelDividerProps) => {
    const pointerIdRef = useRef<number | null>(null);
    const startXRef = useRef(0);

    const endDrag = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) return;
        pointerIdRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onDragEnd();
      },
      [onDragEnd]
    );

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerIdRef.current = event.pointerId;
        startXRef.current = event.clientX;
        onDragStart();
      },
      [onDragStart]
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) return;
        if (event.buttons === 0) {
          endDrag(event);
          return;
        }
        onDrag(index, event.clientX - startXRef.current);
      },
      [index, onDrag, endDrag]
    );

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onNudge(index, -KEY_STEP_PERCENT);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          onNudge(index, KEY_STEP_PERCENT);
        } else if (event.key === 'Home') {
          event.preventDefault();
          onReset();
        }
      },
      [index, onNudge, onReset]
    );

    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={Math.round(position)}
        aria-valuemin={Math.round(min)}
        aria-valuemax={Math.round(max)}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={handleKeyDown}
        onDoubleClick={onReset}
        title="Drag to resize. Double-click to reset."
        className="settings-shell group flex-none w-3 flex items-center justify-center rounded-sm cursor-col-resize touch-none select-none outline-none focus-visible:outline-2 focus-visible:outline-accent-400"
      >
        <span
          aria-hidden="true"
          className="h-10 w-0.5 rounded-full bg-slate-600 transition-colors group-hover:bg-accent-400 group-focus-visible:bg-accent-400"
        />
      </div>
    );
  }
);
PanelDivider.displayName = 'PanelDivider';
