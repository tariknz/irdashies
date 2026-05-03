import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTelemetryStore } from '@irdashies/context';

const GAP = 4; // gap-1 = 4px

interface SectorLike {
  SectorStartPct: number;
}

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
  sectors: SectorLike[],
  totalSectors: number,
  maxSectorsShown: number | null | undefined,
  alwaysScroll: boolean | null | undefined = false
) {
  const effectiveAlwaysScroll = alwaysScroll ?? false;
  const isWindowed =
    effectiveAlwaysScroll ||
    (maxSectorsShown != null && totalSectors > maxSectorsShown);

  const [slotWidth, setSlotWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

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

  const bufferExtra =
    isWindowed && effectiveMaxShown ? Math.ceil(effectiveMaxShown / 2) + 1 : 0;

  const extendedIndices = useMemo(
    () =>
      isWindowed && effectiveMaxShown && totalSectors > 0
        ? buildExtendedIndices(totalSectors, bufferExtra)
        : [],
    [isWindowed, effectiveMaxShown, totalSectors, bufferExtra]
  );

  const step = slotWidth + GAP;
  const containerWidth = effectiveMaxShown ? effectiveMaxShown * step - GAP : 0;
  const centerSlot = isWindowed ? bufferExtra + currentSectorIdx : -1;

  useEffect(() => {
    if (!isWindowed || slotWidth === 0) return;

    const apply = () => {
      const node = stripRef.current;
      if (!node) return;
      const lapDistPct =
        useTelemetryStore.getState().telemetry?.LapDistPct?.value?.[0] ?? 0;
      const sectorStart = sectors[currentSectorIdx]?.SectorStartPct ?? 0;
      const sectorEnd = sectors[currentSectorIdx + 1]?.SectorStartPct ?? 1;
      const progress =
        sectorEnd > sectorStart
          ? Math.max(
              0,
              Math.min(
                1,
                (lapDistPct - sectorStart) / (sectorEnd - sectorStart)
              )
            )
          : 0;
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
    sectors,
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
