import { useLayoutEffect, useRef, useState } from 'react';
import { useTelemetryValue, useSessionVisibility } from '@irdashies/context';
import type { GeneralSettingsType } from '@irdashies/types';
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
  if (!settings.doubleFlag) {
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
          backgroundOpacity={settings.backgroundOpacity}
          compactMode={settings.compactMode}
        />
      </div>
    );
  }

  // Double flag
  return (
    <div className="flex h-full w-full justify-between items-stretch">
      <div className="h-full aspect-square">
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
          backgroundOpacity={settings.backgroundOpacity}
          compactMode={settings.compactMode}
        />
      </div>

      <div className="h-full aspect-square">
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
          backgroundOpacity={settings.backgroundOpacity}
          compactMode={settings.compactMode}
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
  backgroundOpacity = 100,
  compactMode = 'off',
}: {
  label: string;
  showLabel?: boolean;
  textColor?: string;
  matrixSize?: number;
  fullBleed?: boolean;
  enableGlow?: boolean;
  backgroundOpacity?: number;
  compactMode?: GeneralSettingsType['compactMode'];
}) => {
  const isUniform = matrixSize === 1;
  const cols = isUniform ? 1 : matrixSize;
  const rows = isUniform ? 1 : matrixSize;
  const shortLabel = label.split(' ')[0];

  const textColorClass = textColor ?? getTextColorClass(shortLabel);

  const flagType = shortLabel;

  const innerPadding = isUniform ? '1.5%' : '1%';
  const gap = isUniform ? 0 : '1.2%';
  const cellRadius = isUniform ? 16 : 4;
  const aspect = cols / rows;
  const containerPadding =
    compactMode === 'ultra' ? '0%' : compactMode === 'compact' ? '2%' : '4%';

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [flagWidth, setFlagWidth] = useState<number | null>(null);

  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const [gridSize, setGridSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (fullBleed) return;
    const node = wrapRef.current;
    if (!node) return;

    const update = () => {
      const { clientWidth, clientHeight } = node;
      if (!clientWidth || !clientHeight) return;
      setFlagWidth(Math.round(Math.min(clientWidth, clientHeight * aspect)));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => observer.disconnect();
  }, [aspect, fullBleed]);

  useLayoutEffect(() => {
    const node = gridWrapRef.current;
    if (!node) return;

    const updateSize = () => {
      const { clientWidth, clientHeight } = node;
      if (!clientWidth || !clientHeight) return;

      const height = Math.min(clientHeight, clientWidth / aspect);
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

  const leds = Array.from({ length: cols * rows }).map((_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const bg = getLedColor(flagType, row, col, matrixSize, cols, rows);
    const glowIntensity = 8;
    const hasGlow = enableGlow && glowIntensity > 0;
    const boxShadow = hasGlow ? `0 0 ${glowIntensity}px ${bg}` : 'none';

    if (isUniform) {
      return (
        <div
          key="uniform"
          className="w-full h-full box-border"
          style={{ borderRadius: cellRadius, background: bg, boxShadow }}
        />
      );
    }

    return (
      <div
        key={i}
        className="w-full h-full box-border"
        style={{ borderRadius: cellRadius, background: bg, boxShadow }}
      />
    );
  });

  const bgOpacityStyle = {
    ['--bg-opacity' as string]: `${backgroundOpacity}%`,
  };

  const grid = (
    <div
      className="grid bg-black/(--bg-opacity) box-border"
      style={{
        ...bgOpacityStyle,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
        aspectRatio: `${cols} / ${rows}`,
        padding: innerPadding,
        borderRadius: isUniform ? 20 : 12,
        width: gridSize ? `${gridSize.width}px` : '100%',
        height: gridSize ? `${gridSize.height}px` : '100%',
      }}
    >
      {leds}
    </div>
  );

  const labelFontSize = flagWidth
    ? Math.max(10, Math.round(flagWidth * 0.1))
    : 14;
  const labelSidePadding = Math.round(labelFontSize * 0.9);

  const label_el = showLabel && (
    <div
      className="w-full flex items-center justify-center shrink-0"
      style={{ paddingLeft: labelSidePadding, paddingRight: labelSidePadding }}
    >
      <span
        className={`font-black uppercase rounded-md ${textColorClass} ${shortLabel === 'NO' ? 'opacity-0' : ''}`}
        style={{
          fontSize: labelFontSize,
          padding: `${Math.round(labelFontSize * 0.25)}px ${Math.round(labelFontSize * 0.6)}px`,
          backgroundColor: `rgb(0 0 0 / ${backgroundOpacity}%)`,
        }}
      >
        {shortLabel === 'NO' ? 'NO' : shortLabel}
      </span>
    </div>
  );

  if (fullBleed) {
    return (
      <div
        className="flex flex-col items-stretch gap-0 bg-slate-900/(--bg-opacity) border-4 border-slate-800/(--bg-opacity) shadow-2xl w-full h-full box-border m-0 p-0"
        style={bgOpacityStyle}
      >
        <div
          ref={gridWrapRef}
          className="flex-1 w-full flex items-center justify-center min-h-0"
        >
          {grid}
        </div>
        {label_el}
      </div>
    );
  }

  const flagHeight = flagWidth ? Math.round(flagWidth / aspect) : null;

  return (
    <div
      ref={wrapRef}
      className="w-full h-full flex items-center justify-center"
    >
      <div
        className="flex flex-col items-center gap-[3%] bg-slate-900/(--bg-opacity) rounded-2xl border-4 border-slate-800/(--bg-opacity) shadow-2xl"
        style={{
          ...bgOpacityStyle,
          padding: containerPadding,
          width: flagWidth ? `${flagWidth}px` : '100%',
          height: flagHeight ? `${flagHeight}px` : '100%',
        }}
      >
        <div
          ref={gridWrapRef}
          className="flex-1 w-full flex items-center justify-center min-h-0"
        >
          {grid}
        </div>
        {label_el}
      </div>
    </div>
  );
};
