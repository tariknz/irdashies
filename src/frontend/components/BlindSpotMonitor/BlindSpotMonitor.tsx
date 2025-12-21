import { useBlindSpotMonitor, BlindSpotState } from './hooks/useBlindSpotMonitor';
import { useBlindSpotMonitorSettings } from './hooks/useBlindSpotMonitorSettings';
import { BlindSpotMonitorIndicator } from './components/BlindSpotMonitorIndicator';

export interface BlindSpotMonitorDisplayProps {
  show: boolean;
  leftState: BlindSpotState;
  rightState: BlindSpotState;
  leftPercent: number;
  rightPercent: number;
  disableTransition: boolean;
  bgOpacity?: number;
  width?: number;
}

export const BlindSpotMonitorDisplay = ({
  show,
  leftState,
  rightState,
  leftPercent,
  rightPercent,
  disableTransition,
  bgOpacity,
  width,
}: BlindSpotMonitorDisplayProps) => {
  const showLeft = show && (leftState === 'CarLeft' || leftState === 'Cars2Left');
  const showRight = show && (rightState === 'CarRight' || rightState === 'Cars2Right');

  return (
    <div className="w-full h-full relative">
      <BlindSpotMonitorIndicator
        side="left"
        bgOpacity={bgOpacity}
        percent={leftPercent}
        state={leftState}
        width={width}
        visible={showLeft}
        disableTransition={disableTransition}
      />
      <BlindSpotMonitorIndicator
        side="right"
        bgOpacity={bgOpacity}
        percent={rightPercent}
        state={rightState}
        width={width}
        visible={showRight}
        disableTransition={disableTransition}
      />
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
      disableTransition={state.disableTransition}
      bgOpacity={settings?.background?.opacity}
      width={settings?.width}
    />
  );
};

