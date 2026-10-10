import { useState, type CSSProperties, type ReactNode } from 'react';
import { useBroadcastSettings } from './hooks/useBroadcastSettings';
import { pickTransition, rowAnimation } from './towerPages';

const CHECKER_COLUMNS = 8;

/** Squares that clear in a checkered pattern to uncover what is underneath. */
export const CheckerOverlay = ({ rows }: { rows: number }) => (
  <div
    className="pointer-events-none absolute inset-0 grid"
    style={{
      gridTemplateColumns: `repeat(${CHECKER_COLUMNS}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
    }}
  >
    {Array.from({ length: rows * CHECKER_COLUMNS }, (_, i) => {
      const row = Math.floor(i / CHECKER_COLUMNS);
      const col = i % CHECKER_COLUMNS;
      const delay = ((row + col) % 2) * 250 + (row + col) * 15;
      return (
        <span
          key={i}
          className="bg-slate-950"
          style={{
            animation: `broadcast-checker 300ms ease-in ${delay}ms both`,
          }}
        />
      );
    })}
  </div>
);

/**
 * A card that enters with the Broadcast transition (set once on the Broadcast
 * page, kept in the tower config) every time `id` changes, so all modules
 * animate alike.
 */
export const BroadcastEnter = ({
  id,
  className = '',
  style,
  children,
}: {
  id: string | number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) => {
  const mode = useBroadcastSettings()?.pageTransition;
  const [entry, setEntry] = useState(() => ({
    id,
    effect: pickTransition(mode),
  }));
  if (entry.id !== id) {
    setEntry({ id, effect: pickTransition(mode, entry.effect) });
  }
  return (
    <div
      key={entry.id}
      className={`relative ${className}`}
      style={{ ...style, ...rowAnimation(entry.effect, 0) }}
    >
      {children}
      {entry.effect === 'checker' && <CheckerOverlay rows={3} />}
    </div>
  );
};
