import { BlindSpotState } from '../hooks/useBlindSpotMonitor';

export interface BlindSpotMonitorIndicatorProps {
  side: 'left' | 'right';
  bgOpacity?: number;
  percent: number;
  state: BlindSpotState;
  width?: number;
}

export const BlindSpotMonitorIndicator = ({
  side,
  bgOpacity,
  percent,
  state,
  width,
}: BlindSpotMonitorIndicatorProps) => {
  const isTwoCars = state === 'Cars2Left' || state === 'Cars2Right';
  const topPosition = `${25 - percent * 75}%`;
  const widthPx = `${width ?? 20}px`;
  const twoCarsText = state === 'Cars2Left' ? '2 left' : '2 right';

  return (
    <div
      className={`absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'}`}
    >
      <div
        className={`absolute inset-y-0 rounded-full ${side === 'left' ? 'left-0' : 'right-0'} overflow-hidden border`}
        style={{
          backgroundColor:
            bgOpacity !== undefined && bgOpacity > 0
              ? `rgba(0, 0, 0, ${bgOpacity / 100})`
              : 'transparent',
          borderColor:
            bgOpacity !== undefined && bgOpacity > 0
              ? `rgba(0, 0, 0, ${bgOpacity / 100})`
              : 'transparent',
          width: widthPx,
        }}
      >
        <div
          className={`absolute rounded-full h-[50%] left-1/2 -translate-x-1/2 bg-amber-500 flex items-center justify-center`}
          style={{
            top: topPosition,
            width: widthPx,
          }}
        ></div>

        {isTwoCars && (
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
              side === 'left' ? 'rotate-180' : ''
            } bg-black/70 px-2 py-0.5 rounded-full text-amber-500 text-xs font-semibold whitespace-nowrap animate-blink text-shadow-md`}
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
            }}
          >
            {twoCarsText}
          </div>
        )}
      </div>
    </div>
  );
};
