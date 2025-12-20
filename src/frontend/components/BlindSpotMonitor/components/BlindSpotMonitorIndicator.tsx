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
  const isCarAhead = percent >= 0;
  const fillPercent = Math.abs(percent);
  const isTwoCars = state === 'Cars2Left' || state === 'Cars2Right';

  return (
    <div className={`absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} w-[20px]`}>
      {bgOpacity !== undefined && bgOpacity > 0 && (
        <div
          className={`absolute inset-y-0 rounded-full w-[20px] ${side === 'left' ? 'left-0' : 'right-0'} bg-black`}
          style={{
            opacity: bgOpacity / 100,
          }}
        />
      )}
      <div
        className={`absolute ${isCarAhead ? 'bottom-0' : 'top-0'} rounded-full w-[20px] h-full ${side === 'left' ? 'left-0' : 'right-0'} ${isTwoCars ? 'bg-red-500' : 'bg-amber-500'}`}
        style={{
          transform: `scaleY(${fillPercent})`,
          transformOrigin: isCarAhead ? 'bottom' : 'top',
        }}
      />
    </div>
  );
};

