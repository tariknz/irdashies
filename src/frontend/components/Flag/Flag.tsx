import { useLayoutEffect, useRef, useState } from 'react';
import { useTelemetryValue, useSessionVisibility } from '@irdashies/context';
import { useFlagSettings } from './hooks/useFlagSettings';
import { useBlinkState } from './hooks/useBlinkState';
import { getLedColor } from './hooks/getLedColor';
import { getTextColorClass } from './hooks/getTextColorClass';
import { getFlag } from '@irdashies/utils/getFlag';

export const Flag = () => {
  const settings = useFlagSettings();

  const sessionFlags = useTelemetryValue<number>('SessionFlags') ?? 0;
  const isPlayerOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;
  const isVisibleInSession = useSessionVisibility(settings.sessionVisibility);

  const blinkOn = useBlinkState(settings.animate, settings.blinkPeriod);

  if (!isVisibleInSession) return null;
  if (settings.showOnlyWhenOnTrack && !isPlayerOnTrack) return null;

  const flagInfo = getFlag(sessionFlags);

  const visibleLabel =
    settings.animate && !blinkOn ? 'NO FLAG' : flagInfo.label;

  // 4. Hide widget if NO FLAG state is disabled and no flags are waved (check actual flag, not visible label)
  if (flagInfo.label === 'NO FLAG' && !settings.showNoFlagState) return null;

  // Single flag
  if (!settings.doubleflag) {
    return (
      <div className="h-full">
        <FlagDisplay
      label={visibleLabel}
      showLabel={settings.showLabel ?? true}
      matrixSize={
        settings.matrixMode === '8x8'
          ? 8
          : settings.matrixMode === '16x16'
            ? 16
            : 1
      }
      enableGlow={settings.enableGlow ?? true}
    />
      </div>
    );
  }

  // Double flag
  return (
    <div className="flex h-full w-full justify-between items-stretch">
      <div className="h-full">
        <FlagDisplay
      label={visibleLabel}
      showLabel={settings.showLabel ?? true}
      matrixSize={
        settings.matrixMode === '8x8'
          ? 8
          : settings.matrixMode === '16x16'
            ? 16
            : 1
      }
      enableGlow={settings.enableGlow ?? true}
    />
      </div>

      <div className="h-full">
        <FlagDisplay
      label={visibleLabel}
      showLabel={settings.showLabel ?? true}
      matrixSize={
        settings.matrixMode === '8x8'
          ? 8
          : settings.matrixMode === '16x16'
            ? 16
            : 1
      }
      enableGlow={settings.enableGlow ?? true}
    />
      </div>
    </div>
  );
};

export const FlagDisplay = ({
  label,
  showLabel = true,
  textColor,
  matrixSize = 16,
  fullBleed = false,
  enableGlow = true,
}: {
  label: string;
  showLabel?: boolean;
  textColor?: string;
  matrixSize?: number;
  fullBleed?: boolean;
  enableGlow?: boolean;
}) => {
  const isUniform = matrixSize === 1;
  const cols = isUniform ? 1 : matrixSize;
  const rows = isUniform ? 1 : matrixSize;
  const shortLabel = label.split(' ')[0];

  const textColorClass = textColor ?? getTextColorClass(shortLabel);

  const flagType = shortLabel; // e.g., 'YELLOW', 'CHECKERED', 'MEATBALL', etc.

  const innerPadding = isUniform ? '1.5%' : '1%'; // scale padding with display size
  const gap = isUniform ? 0 : '1.2%';
  const cellRadius = isUniform ? 16 : 4;
  const aspect = cols / rows;

  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const [gridSize, setGridSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const node = gridWrapRef.current;
    if (!node) return;

    const updateSize = () => {
      const { clientWidth, clientHeight } = node;
      if (!clientWidth || !clientHeight) return;

      const height = clientHeight;
      const width = height * aspect;

      setGridSize({
        width: Math.round(width),
        height: Math.round(height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, [aspect]);

  const outerClass = fullBleed
    ? 'flex flex-col items-stretch gap-0 bg-slate-900 border-4 border-slate-800 shadow-2xl w-full h-full box-border m-0 p-0'
    : 'flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl w-full h-full';

  return (
    <div className={outerClass}>
      <div
        ref={gridWrapRef}
        className="flex-1 w-full flex items-center justify-center min-h-0"
      >
        <div
          className="grid bg-black box-border"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap,
            aspectRatio: `${cols} / ${rows}`,
            padding: innerPadding,
            borderRadius: isUniform ? 20 : 12,
            width: gridSize ? `${gridSize.width}px` : '100%',
            height: gridSize ? `${gridSize.height}px` : '100%',
          }}
        >
        {Array.from({ length: cols * rows }).map((_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const bg = getLedColor(flagType, row, col, matrixSize, cols, rows);
          const glowIntensity = 8;
          const hasGlow = enableGlow && glowIntensity > 0;
          const boxShadow = hasGlow ? `0 0 ${glowIntensity}px ${bg}` : 'none';

          // For uniform mode render a single cell that fills the area
          if (isUniform) {
            return (
              <div
                key="uniform"
                className="w-full h-full box-border"
                style={{
                  borderRadius: cellRadius,
                  background: bg,
                  boxShadow,
                }}
              />
            );
          }

          return (
            <div
              key={i}
              className="w-full h-full box-border"
              style={{
                borderRadius: cellRadius,
                background: bg,
                boxShadow,
              }}
            />
          );
        })}
        </div>
      </div>
      <div className="w-full h-6 flex items-center justify-center shrink-0">
        {showLabel && (
          <span
            className={`text-sm font-black px-3 py-1 uppercase rounded-md bg-black ${textColorClass} ${shortLabel === 'NO' ? 'opacity-0' : ''}`}
          >
            {shortLabel === 'NO' ? 'NO' : shortLabel}
          </span>
        )}
      </div>
    </div>
  );
};
