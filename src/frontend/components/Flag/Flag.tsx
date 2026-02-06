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
  if (flagInfo.label === 'NO FLAG' && !settings.showNoFlagState) return null;

  const visibleLabel =
    settings.animate && !blinkOn ? 'NO FLAG' : flagInfo.label;

  const matrixSize =
    settings.matrixMode === '8x8'
      ? 8
      : settings.matrixMode === '16x16'
        ? 16
        : 1;

  const flagProps = {
    label: visibleLabel,
    showLabel: settings.showLabel ?? true,
    matrixSize,
    enableGlow: settings.enableGlow ?? true,
    fullBleed: true,
  };

  // 🔹 SINGLE FLAG
  if (!settings.doubleflag) {
    return (
      <div className="h-full">
        <FlagDisplay {...flagProps} />
      </div>
    );
  }

  // 🔹 DOUBLE FLAG — height-driven, edge-pinned
  return (
    <div className="flex h-full w-full justify-between items-stretch">
      <div className="h-full">
        <FlagDisplay {...flagProps} />
      </div>

      <div className="h-full">
        <FlagDisplay {...flagProps} />
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

  const outerClass = fullBleed
    ? 'flex flex-col items-stretch gap-0 bg-slate-900 border-4 border-slate-800 shadow-2xl w-full h-full box-border m-0'
    : 'flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl w-full';

  const outerStyle = fullBleed && showLabel ? { paddingBottom: '20px' } : {};

  return (
    <div className={outerClass} style={outerStyle}>
      <div
        className="grid w-full bg-black box-border"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap,
          aspectRatio: `${cols} / ${rows}`,
          padding: innerPadding,
          borderRadius: isUniform ? 20 : 12,
          height: fullBleed ? '100%' : undefined,
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
      <div
        className={`flex w-full justify-center ${
          showLabel ? 'min-h-6' : 'min-h-0'
        }`}
      >
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