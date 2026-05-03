import { useLayoutEffect, useRef } from 'react';
import { useTelemetryStore } from '@irdashies/context';

/**
 * Track-progress overlay for the active card. Subscribes to LapDistPct
 * directly and mutates style.width on its own elements — no React renders
 * per frame.
 *
 * useLayoutEffect ensures the initial width is applied before paint, so the
 * bars don't flash at 0% on mount.
 */
export const SectorProgressIndicator = ({
  sectorStart,
  sectorEnd,
  isWindowed,
}: {
  sectorStart: number;
  sectorEnd: number;
  isWindowed: boolean;
}) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const apply = () => {
      const lapDistPct =
        useTelemetryStore.getState().telemetry?.LapDistPct?.value?.[0] ?? 0;
      const span = sectorEnd - sectorStart;
      const progress =
        span > 0
          ? Math.max(0, Math.min(1, (lapDistPct - sectorStart) / span))
          : 0;
      const w = `${progress * 100}%`;
      if (fillRef.current) fillRef.current.style.width = w;
      if (topBarRef.current) topBarRef.current.style.width = w;
      if (bottomBarRef.current) bottomBarRef.current.style.width = w;
    };

    apply();
    return useTelemetryStore.subscribe(apply);
  }, [sectorStart, sectorEnd]);

  return (
    <>
      <div
        ref={fillRef}
        className="absolute top-0 left-0 bottom-0 w-0"
        style={{ backgroundColor: 'rgba(56, 189, 248, 0.4)' }}
      />
      {!isWindowed && (
        <>
          <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-sky-400" />
          <div
            ref={topBarRef}
            className="absolute top-0 left-0 h-0.5 w-0 bg-sky-400"
          />
          <div
            ref={bottomBarRef}
            className="absolute bottom-0 left-0 h-0.5 w-0 bg-sky-400"
          />
        </>
      )}
    </>
  );
};
