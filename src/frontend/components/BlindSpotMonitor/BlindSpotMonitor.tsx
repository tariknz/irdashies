import { useBlindSpotMonitor } from './hooks/useBlindSpotMonitor';
import { useBlindSpotMonitorSettings } from './hooks/useBlindSpotMonitorSettings';
import { BlindSpotMonitorIndicator } from './components/BlindSpotMonitorIndicator';
import { BlindSpotMonitorSimpleIndicator } from './components/BlindSpotMonitorSimpleIndicator';
import {
  useDashboard,
  useSessionVisibility,
  useTelemetryValue,
} from '@irdashies/context';
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
  displayMode?: 'standard' | 'simple';
  simpleSize?: number;
  simpleVerticalPosition?: number;
  simpleShowCount?: boolean;
  thresholdColorsEnabled?: boolean;
  thresholdColor1?: number;
  thresholdColor2?: number;
}

const DEFAULT_INDICATOR_COLOR = 16096779;
const DEFAULT_THRESHOLD_COLOR_1 = 16096779;
const DEFAULT_THRESHOLD_COLOR_2 = 15680580;

const carCountFromState = (state: CarLeftRight): 1 | 2 =>
  state === CarLeftRight.Cars2Left || state === CarLeftRight.Cars2Right ? 2 : 1;

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
  displayMode = 'standard',
  simpleSize = 44,
  simpleVerticalPosition = 50,
  simpleShowCount = true,
  thresholdColorsEnabled = false,
  thresholdColor1 = DEFAULT_THRESHOLD_COLOR_1,
  thresholdColor2 = DEFAULT_THRESHOLD_COLOR_2,
}: BlindSpotMonitorDisplayProps) => {
  const showLeft =
    show &&
    (leftState === CarLeftRight.CarLeft ||
      leftState === CarLeftRight.Cars2Left);
  const showRight =
    show &&
    (rightState === CarLeftRight.CarRight ||
      rightState === CarLeftRight.Cars2Right);

  if (displayMode === 'simple') {
    return (
      <div className="w-full h-full relative">
        <BlindSpotMonitorSimpleIndicator
          side="left"
          visible={showLeft}
          carCount={carCountFromState(leftState)}
          size={simpleSize}
          verticalPosition={simpleVerticalPosition}
          showCount={simpleShowCount}
          indicatorColor={indicatorColor ?? DEFAULT_INDICATOR_COLOR}
          thresholdColorsEnabled={thresholdColorsEnabled}
          thresholdColor1={thresholdColor1}
          thresholdColor2={thresholdColor2}
        />
        <BlindSpotMonitorSimpleIndicator
          side="right"
          visible={showRight}
          carCount={carCountFromState(rightState)}
          size={simpleSize}
          verticalPosition={simpleVerticalPosition}
          showCount={simpleShowCount}
          indicatorColor={indicatorColor ?? DEFAULT_INDICATOR_COLOR}
          thresholdColorsEnabled={thresholdColorsEnabled}
          thresholdColor1={thresholdColor1}
          thresholdColor2={thresholdColor2}
        />
      </div>
    );
  }

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

const DEMO_STATE_SIMPLE = {
  show: true,
  leftState: CarLeftRight.CarLeft,
  rightState: CarLeftRight.Cars2Right,
  leftPercent: 0,
  rightPercent: 0,
  disableTransition: true,
};

export const BlindSpotMonitor = () => {
  const state = useBlindSpotMonitor();
  const settings = useBlindSpotMonitorSettings();
  const { isDemoMode } = useDashboard();
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;

  const sessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const isSimple = settings?.displayMode === 'simple';
  const activeState = isDemoMode && isSimple ? DEMO_STATE_SIMPLE : state;

  if (!isDemoMode && !sessionVisible) return <></>;
  if (!isDemoMode && settings?.showOnlyWhenOnTrack && !isOnTrack) return <></>;

  return (
    <BlindSpotMonitorDisplay
      show={activeState.show}
      leftState={activeState.leftState}
      rightState={activeState.rightState}
      leftPercent={activeState.leftPercent}
      rightPercent={activeState.rightPercent}
      disableTransition={activeState.disableTransition}
      bgOpacity={settings?.background?.opacity}
      width={settings?.width}
      borderSize={settings?.borderSize}
      indicatorColor={settings?.indicatorColor}
      displayMode={settings?.displayMode}
      simpleSize={settings?.simpleSize}
      simpleVerticalPosition={settings?.simpleVerticalPosition}
      simpleShowCount={settings?.simpleShowCount}
      thresholdColorsEnabled={settings?.thresholdColorsEnabled}
      thresholdColor1={settings?.thresholdColor1}
      thresholdColor2={settings?.thresholdColor2}
    />
  );
};
