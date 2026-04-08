import { memo, useMemo, ReactNode } from 'react';
import { useCyclingAnimation } from './useCyclingAnimation';

interface RotatingSlotCellProps {
  children: ReactNode[];
  animationCycleTime?: number;
  compactMode?: string;
  className?: string;
}

export const RotatingSlotCell = memo(
  ({
    children,
    animationCycleTime,
    compactMode,
    className,
  }: RotatingSlotCellProps) => {
    // Create stable ref objects for each child
    const childRefs = useMemo(
      () =>
        children.map(
          () =>
            ({
              current: null,
            }) as { current: HTMLDivElement | null }
        ),
      [children]
    );

    const enabled = children.length > 1;
    const freq = animationCycleTime ?? 5;

    // Apply synced cycling animations
    useCyclingAnimation(childRefs, freq * children.length * 1000, enabled);

    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';

    return (
      <td
        data-column="rotation-group"
        className={`w-auto whitespace-nowrap text-center ${pxClass} ${className ?? ''}`}
      >
        <div className="grid h-[1lh] items-center justify-center overflow-hidden">
          {children.map((child, i) => (
            <div
              key={i}
              ref={childRefs[i]}
              className="[grid-area:1/1] h-full flex items-center justify-center"
              style={{
                // Initial state for items that will be animated
                // We no longer use visibility: hidden as it interferes with WAAPI
                opacity: !enabled || i === 0 ? 1 : 0,
              }}
            >
              {child}
            </div>
          ))}
        </div>
      </td>
    );
  }
);

RotatingSlotCell.displayName = 'RotatingSlotCell';
