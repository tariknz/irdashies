export interface BlindSpotMonitorSimpleIndicatorProps {
  side: 'left' | 'right';
  visible: boolean;
  carCount: 1 | 2;
  size: number;
  verticalPosition: number;
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
      className={`absolute ${side === 'left' ? 'left-0' : 'right-0'}`}
      style={{
        top: `${verticalPosition}%`,
        transform: 'translateY(-50%)',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: colorHex,
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.round(size * 0.5)}px`,
        fontWeight: 700,
        color: '#1e293b',
      }}
    >
      {carCount}
    </div>
  );
};
