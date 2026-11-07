import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@phosphor-icons/react';

interface ReorderControlsProps {
  label: string;
  position: number;
  total: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/** A single-pointer and keyboard alternative to the existing drag handle. */
export const ReorderControls = ({
  label,
  position,
  total,
  onMoveUp,
  onMoveDown,
}: ReorderControlsProps) => {
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const moved = useRef<'up' | 'down' | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useLayoutEffect(() => {
    // Reinserted rows may lose focus even before reaching a boundary.
    const direction = moved.current;
    moved.current = null;
    if (direction === 'up') (onMoveUp ? upRef : downRef).current?.focus();
    if (direction === 'down') (onMoveDown ? downRef : upRef).current?.focus();
  }, [onMoveUp, onMoveDown]);

  return (
    <div className="relative flex shrink-0 items-center gap-1">
      <button
        ref={upRef}
        type="button"
        aria-label={`Move ${label} up`}
        title="Move up"
        disabled={!onMoveUp}
        onClick={() => {
          moved.current = 'up';
          onMoveUp?.();
          setAnnouncement(
            `${label} moved up. Position ${position - 1} of ${total}.`
          );
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-settings-hover hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowUpIcon size={16} aria-hidden="true" />
      </button>
      <button
        ref={downRef}
        type="button"
        aria-label={`Move ${label} down`}
        title="Move down"
        disabled={!onMoveDown}
        onClick={() => {
          moved.current = 'down';
          onMoveDown?.();
          setAnnouncement(
            `${label} moved down. Position ${position + 1} of ${total}.`
          );
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-settings-hover hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowDownIcon size={16} aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  );
};
