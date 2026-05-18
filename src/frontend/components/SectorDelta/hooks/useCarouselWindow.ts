import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTelemetryStore } from '@irdashies/context';

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
 * exact track position.
 *
 * The strip transform is updated imperatively from the telemetry store
 * (~60×/sec) so the React tree does not re-render every frame — only the
 * `style.transform` of the strip element mutates.
 */
export function useCarouselWindow(
  currentSectorIdx: number,
  currentSectorStart: number,
  currentSectorEnd: number,
  totalSectors: number,
  maxSectorsShown: number | null | undefined,
  alwaysScroll: boolean | null | undefined = false
) {
  const effectiveAlwaysScroll = alwaysScroll ?? false;
  const isWindowed =
    effectiveAlwaysScroll ||
    (maxSectorsShown != null && totalSectors > maxSectorsShown);

  const [slotWidth, setSlotWidth] = useState(0);
  // Callback ref so the measure effect re-runs when the container element
  // actually attaches. The parent returns null while sectors are empty, so
  // a plain useRef would still be null on the first render where layout
  // params (isWindowed, effectiveMaxShown) are stable, leaving slotWidth=0.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);
  const stripRef = useRef<HTMLDivElement>(null);

  // When alwaysScroll is on but maxSectorsShown is unset, fit all sectors.
  const effectiveMaxShown =
    maxSectorsShown ?? (isWindowed ? totalSectors : undefined);

  useLayoutEffect(() => {
    if (!isWindowed || !effectiveMaxShown || !container) return;

    const measure = () => {
      setSlotWidth(
        (container.offsetWidth - (effectiveMaxShown - 1) * GAP) /
          effectiveMaxShown
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [isWindowed, effectiveMaxShown, container]);

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

  // Pixel width of one slot (card + trailing gap), and total container width.
  const step = slotWidth + GAP;
  const containerWidth = effectiveMaxShown ? effectiveMaxShown * step - GAP : 0;
  const centerSlot = isWindowed ? bufferExtra + currentSectorIdx : -1;

  // Drive the strip transform imperatively. useLayoutEffect so the initial
  // apply runs before paint — avoids a one-frame flash at translateX(0) on
  // mount or whenever the layout (slotWidth, currentSectorIdx) changes.
  useLayoutEffect(() => {
    if (!isWindowed || slotWidth === 0) return;

    const apply = () => {
      const node = stripRef.current;
      if (!node) return;
      const lapDistPct =
        useTelemetryStore.getState().telemetry?.LapDistPct?.value?.[0] ?? 0;
      const span = currentSectorEnd - currentSectorStart;
      const progress =
        span > 0
          ? Math.max(0, Math.min(1, (lapDistPct - currentSectorStart) / span))
          : 0;
      // Whole-card steps for completed sectors, then fractional slotWidth
      // within the current card (gap is not traversed mid-card).
      const stripPosition =
        (bufferExtra + currentSectorIdx) * step + progress * slotWidth;
      node.style.transform = `translateX(${containerWidth / 2 - stripPosition}px)`;
    };

    apply();
    return useTelemetryStore.subscribe(apply);
  }, [
    isWindowed,
    slotWidth,
    step,
    bufferExtra,
    containerWidth,
    currentSectorIdx,
    currentSectorStart,
    currentSectorEnd,
  ]);

  return {
    isWindowed,
    extendedIndices,
    slotWidth,
    containerRef,
    stripRef,
    centerSlot,
  };
}
