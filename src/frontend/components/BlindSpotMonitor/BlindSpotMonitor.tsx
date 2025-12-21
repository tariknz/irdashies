import { useBlindSpotMonitor, BlindSpotState } from './hooks/useBlindSpotMonitor';
import { useBlindSpotMonitorSettings } from './hooks/useBlindSpotMonitorSettings';
import { BlindSpotMonitorIndicator } from './components/BlindSpotMonitorIndicator';

export interface BlindSpotMonitorDisplayProps {
  show: boolean;
  leftState: BlindSpotState;
  rightState: BlindSpotState;
  leftPercent: number;
  rightPercent: number;
  bgOpacity?: number;
  width?: number;
}

export const BlindSpotMonitorDisplay = ({
  show,
  leftState,
  rightState,
  leftPercent,
  rightPercent,
  bgOpacity,
  width,
}: BlindSpotMonitorDisplayProps) => {
  if (!show) {
    return null;
  }

  return (
    <div className="w-full h-full relative">
      {(leftState === 'CarLeft' || leftState === 'Cars2Left') && (
        <BlindSpotMonitorIndicator
          side="left"
          bgOpacity={bgOpacity}
          percent={leftPercent}
          state={leftState}
          width={width}
        />
      )}
      {(rightState === 'CarRight' || rightState === 'Cars2Right') && (
        <BlindSpotMonitorIndicator
          side="right"
          bgOpacity={bgOpacity}
          percent={rightPercent}
          state={rightState}
          width={width}
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
      width={settings?.width}
    />
  );
};

