import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';

const GAP = 4; // gap-1 = 4px

/**
 * Builds an extended sector index list with buffer sectors on each side:
 *   [ ...last bufferExtra sectors, ...all sectors, ...first bufferExtra sectors ]
 *
 * This ensures the strip has visible content near the lap start/end boundary
 * without any special-casing — the pre/post sectors scroll into view naturally.
 */
function buildExtendedIndices(
  totalSectors: number,
  bufferExtra: number
): number[] {
  return Array.from({ length: totalSectors + 2 * bufferExtra }, (_, i) => {
    const rawIdx = i - bufferExtra;
    return ((rawIdx % totalSectors) + totalSectors) % totalSectors;
  });
}

/**
 * Drives a continuously scrolling sector strip centered on the player's
 * exact track position. The strip translates every time sectorProgress
 * changes (i.e. every lapDistPct update), so the current position is
 * always pinned to the horizontal center of the viewport.
 *
 * Partial sector cards are visible on both edges at all times.
 */
export function useCarouselWindow(
  currentSectorIdx: number,
  sectorProgress: number,
  totalSectors: number,
  maxSectorsShown: number | undefined,
  alwaysScroll = false
) {
  const isWindowed =
    alwaysScroll || (maxSectorsShown != null && totalSectors > maxSectorsShown);

  const [slotWidth, setSlotWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // When alwaysScroll is on but maxSectorsShown is unset, fit all sectors.
  const effectiveMaxShown =
    maxSectorsShown ?? (isWindowed ? totalSectors : undefined);

  useLayoutEffect(() => {
    if (!isWindowed || !effectiveMaxShown || !containerRef.current) return;

    const measure = () => {
      if (!containerRef.current) return;
      setSlotWidth(
        (containerRef.current.offsetWidth - (effectiveMaxShown - 1) * GAP) /
          effectiveMaxShown
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [isWindowed, effectiveMaxShown]);

  // Extra sectors rendered before sector 0 and after the last sector.
  // Enough to fill half the visible window so the edges are always covered.
  const bufferExtra =
    isWindowed && effectiveMaxShown ? Math.ceil(effectiveMaxShown / 2) + 1 : 0;

  const extendedIndices = useMemo(
    () =>
      isWindowed && effectiveMaxShown && totalSectors > 0
        ? buildExtendedIndices(totalSectors, bufferExtra)
        : [],
    [isWindowed, effectiveMaxShown, totalSectors, bufferExtra]
  );

  // Pixel width of one slot (card + trailing gap), and total container width
  const step = slotWidth + GAP;
  const containerWidth = effectiveMaxShown ? effectiveMaxShown * step - GAP : 0;

  // Position in the strip of the player's exact track point.
  // Uses whole-card steps for completed sectors, then fractional slotWidth
  // within the current card (gap is not traversed mid-card).
  const stripPosition =
    (bufferExtra + currentSectorIdx) * step + sectorProgress * slotWidth;

  const stripStyle: React.CSSProperties = isWindowed
    ? { transform: `translateX(${containerWidth / 2 - stripPosition}px)` }
    : {};

  return {
    isWindowed,
    extendedIndices,
    slotWidth,
    containerRef,
    stripStyle,
  };
}
