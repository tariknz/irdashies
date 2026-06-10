export interface BlindSpotMonitorSimpleIndicatorProps {
  side: 'left' | 'right';
  visible: boolean;
  carCount: 1 | 2;
  size: number;
  verticalPosition: number;
  showCount: boolean;
  indicatorColor: number;
  thresholdColorsEnabled: boolean;
  thresholdColor1: number;
  thresholdColor2: number;
}

export const BlindSpotMonitorSimpleIndicator = ({
  side,
  visible,
  carCount,
  size,
  verticalPosition,
  showCount,
  indicatorColor,
  thresholdColorsEnabled,
  thresholdColor1,
  thresholdColor2,
}: BlindSpotMonitorSimpleIndicatorProps) => {
  if (!visible) return null;

  let color = indicatorColor;
  if (thresholdColorsEnabled) {
    color = carCount >= 2 ? thresholdColor2 : thresholdColor1;
  }
  const colorHex = `#${color.toString(16).padStart(6, '0')}`;

  return (
    <div
      className={`absolute flex items-center justify-center ${side === 'left' ? 'left-0' : 'right-0'}`}
      style={{
        top: `${verticalPosition}%`,
        transform: 'translateY(-50%)',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: colorHex,
        borderRadius: '6px',
      }}
    >
      {showCount && (
        <span
          className={`bg-black/70 rounded-full text-amber-500 font-semibold text-shadow-md${carCount === 2 ? ' animate-blink' : ''}`}
          style={{
            fontFamily: 'inherit',
            fontSize: `${Math.round(size * 0.42)}px`,
            padding: `${Math.round(size * 0.05)}px ${Math.round(size * 0.1)}px`,
          }}
        >
          {carCount}
        </span>
      )}
    </div>
  );
};
