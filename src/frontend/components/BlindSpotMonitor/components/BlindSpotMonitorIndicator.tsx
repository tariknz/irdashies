import { BlindSpotState } from '../hooks/useBlindSpotMonitor';

export interface BlindSpotMonitorIndicatorProps {
  side: 'left' | 'right';
  bgOpacity?: number;
  percent: number;
  state: BlindSpotState;
}

export const BlindSpotMonitorIndicator = ({
  side,
  bgOpacity,
  percent,
  state,
}: BlindSpotMonitorIndicatorProps) => {
  const isTwoCars = state === 'Cars2Left' || state === 'Cars2Right';
  const topPosition = `${25 - percent * 75}%`;
  const width = '20px';

  return (
    <div className={`absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} w-[${width}]`}>
      <div
        className={`absolute inset-y-0 rounded-full w-[${width}] ${side === 'left' ? 'left-0' : 'right-0'} overflow-hidden border`}
        style={{
          backgroundColor: bgOpacity !== undefined && bgOpacity > 0 ? `rgba(0, 0, 0, ${bgOpacity / 100})` : 'transparent',
          borderColor: bgOpacity !== undefined && bgOpacity > 0 ? `rgba(0, 0, 0, ${bgOpacity / 100})` : 'transparent',
        }}
      >
        <div
          className={`absolute rounded-full w-[${width}] h-[50%] left-1/2 -translate-x-1/2 ${isTwoCars ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{
            top: topPosition,
          }}
        />
      </div>
    </div>
  );
};

