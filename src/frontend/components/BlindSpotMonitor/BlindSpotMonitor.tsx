import { useBlindSpotMonitor, BlindSpotState } from './hooks/useBlindSpotMonitor';
import { useBlindSpotMonitorSettings } from './hooks/useBlindSpotMonitorSettings';

interface IndicatorProps {
  side: 'left' | 'right';
  bgOpacity?: number;
  percent: number;
  state: BlindSpotState;
}

const Indicator = ({
  side,
  bgOpacity,
  percent,
  state,
}: IndicatorProps) => {
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

export interface BlindSpotMonitorDisplayProps {
  show: boolean;
  leftState: BlindSpotState;
  rightState: BlindSpotState;
  leftPercent: number;
  rightPercent: number;
  bgOpacity?: number;
}

export const BlindSpotMonitorDisplay = ({
  show,
  leftState,
  rightState,
  leftPercent,
  rightPercent,
  bgOpacity,
}: BlindSpotMonitorDisplayProps) => {
  if (!show) {
    return null;
  }

  return (
    <div className="w-full h-full relative">
      {(leftState === 'CarLeft' || leftState === 'Cars2Left') && (
        <Indicator
          side="left"
          bgOpacity={bgOpacity}
          percent={leftPercent}
          state={leftState}
        />
      )}
      {(rightState === 'CarRight' || rightState === 'Cars2Right') && (
        <Indicator
          side="right"
          bgOpacity={bgOpacity}
          percent={rightPercent}
          state={rightState}
        />
      )}
    </div>
  );
};

export const BlindSpotMonitor = () => {
  const state = useBlindSpotMonitor();
  const settings = useBlindSpotMonitorSettings();

  return (
    <BlindSpotMonitorDisplay
      show={state.show}
      leftState={state.leftState}
      rightState={state.rightState}
      leftPercent={state.leftPercent}
      rightPercent={state.rightPercent}
      bgOpacity={settings?.background?.opacity}
    />
  );
};

