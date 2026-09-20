import { useTachometerData } from './hooks/useTachometerData';
import { useShiftLightSettings } from './hooks/useShiftLightSettings';
import { ShiftLight as ShiftLightComponent } from './ShiftLightComponent/ShiftLightComponent';
import { useDrivingState, useSessionVisibility } from '@irdashies/context';

export const ShiftLight = () => {
  const tachometerData = useTachometerData();
  const settings = useShiftLightSettings();

  const { isDriving } = useDrivingState();

  const sessionVisible = useSessionVisibility(settings?.sessionVisibility);
  if (!sessionVisible) return <></>;

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  return (
    <ShiftLightComponent
      rpm={tachometerData.rpm}
      gear={tachometerData.gear}
      maxRpm={tachometerData.maxRpm}
      shiftRpm={tachometerData.shiftRpm}
      blinkRpm={tachometerData.blinkRpm}
      showRpmText={settings?.showRpmText ?? true}
      gearRpmThresholds={tachometerData.gearRpmThresholds}
      ledColors={tachometerData.carData?.ledColor}
      carData={tachometerData.carData}
      carPath={tachometerData.carPath}
      shiftPointSettings={settings?.shiftPointSettings}
      opacity={settings?.background.opacity}
    />
  );
};
