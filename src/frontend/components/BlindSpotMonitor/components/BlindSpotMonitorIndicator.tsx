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

  return (
    <div className={`absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} w-[20px]`}>
      <div
        className={`absolute inset-y-0 rounded-full w-[20px] ${side === 'left' ? 'left-0' : 'right-0'} overflow-hidden`}
        style={{
          backgroundColor: bgOpacity !== undefined && bgOpacity > 0 ? `rgba(0, 0, 0, ${bgOpacity / 100})` : 'transparent',
        }}
      >
        <div
          className={`absolute rounded-full w-[20px] h-[50%] ${side === 'left' ? 'left-0' : 'right-0'} ${isTwoCars ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{
            top: topPosition,
          }}
        />
      </div>
    </div>
  );
};

