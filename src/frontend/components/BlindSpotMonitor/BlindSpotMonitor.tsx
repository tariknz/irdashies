import { useBlindSpotMonitor } from './hooks/useBlindSpotMonitor';
import { useBlindSpotMonitorSettings } from './hooks/useBlindSpotMonitorSettings';
import { BlindSpotMonitorIndicator } from './components/BlindSpotMonitorIndicator';
import { useSessionVisibility, useTelemetryValue } from '@irdashies/context';
import { CarLeftRight } from '@irdashies/types';

export interface BlindSpotMonitorDisplayProps {
  show: boolean;
  leftState: CarLeftRight;
  rightState: CarLeftRight;
  leftPercent: number;
  rightPercent: number;
  disableTransition?: boolean;
  bgOpacity?: number;
  width?: number;
  borderSize?: number;
  indicatorColor?: number;
}

export const BlindSpotMonitorDisplay = ({
  show,
  leftState,
  rightState,
  leftPercent,
  rightPercent,
  disableTransition = false,
  bgOpacity,
  width,
  borderSize,
  indicatorColor,
}: BlindSpotMonitorDisplayProps) => {
  const showLeft =
    show &&
    (leftState === CarLeftRight.CarLeft ||
      leftState === CarLeftRight.Cars2Left);
  const showRight =
    show &&
    (rightState === CarLeftRight.CarRight ||
      rightState === CarLeftRight.Cars2Right);

  return (
    <div className="w-full h-full relative">
      <BlindSpotMonitorIndicator
        side="left"
        bgOpacity={bgOpacity}
        percent={leftPercent}
        state={leftState}
        width={width}
        borderSize={borderSize}
        indicatorColor={indicatorColor}
        visible={showLeft}
        disableTransition={disableTransition}
      />
      <BlindSpotMonitorIndicator
        side="right"
        bgOpacity={bgOpacity}
        percent={rightPercent}
        state={rightState}
        width={width}
        borderSize={borderSize}
        indicatorColor={indicatorColor}
        visible={showRight}
        disableTransition={disableTransition}
      />
    </div>
  );
};

export const BlindSpotMonitor = () => {
  const state = useBlindSpotMonitor();
  const settings = useBlindSpotMonitorSettings();
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;
  if (settings?.showOnlyWhenOnTrack && !isOnTrack) return <></>;

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
      borderSize={settings?.borderSize}
      indicatorColor={settings?.indicatorColor}
    />
  );
};
