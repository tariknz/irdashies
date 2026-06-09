import type { CSSProperties } from 'react';
import type { EdgeDistances } from './useEdgeDistances';

interface Props {
  distances: EdgeDistances;
}

const labelStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  userSelect: 'none',
};

const cls =
  'text-xs font-mono bg-slate-900/90 text-sky-400 px-1.5 py-0.5 rounded leading-none';

/** Renders four floating labels showing pixel distances from a widget to each viewport edge. */
export const EdgeDistanceLabels = ({ distances }: Props) => {
  return (
    <>
      <div
        className={cls}
        style={{
          ...labelStyle,
          top: 4,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {Math.round(distances.top)}
      </div>
      <div
        className={cls}
        style={{
          ...labelStyle,
          bottom: 4,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {Math.round(distances.bottom)}
      </div>
      <div
        className={cls}
        style={{
          ...labelStyle,
          left: 4,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        {Math.round(distances.left)}
      </div>
      <div
        className={cls}
        style={{
          ...labelStyle,
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        {Math.round(distances.right)}
      </div>
    </>
  );
};

EdgeDistanceLabels.displayName = 'EdgeDistanceLabels';
