import { useTachometerData } from './hooks/useTachometerData';
import { useTachometerSettings } from './hooks/useTachometerSettings';
import { Tachometer as TachometerComponent } from './TachometerComponent/TachometerComponent';
import { useDrivingState, useSessionVisibility } from '@irdashies/context';

export const Tachometer = () => {
  const tachometerData = useTachometerData();
  const settings = useTachometerSettings();

  const { isDriving } = useDrivingState();

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  return (
    <TachometerComponent
      rpm={tachometerData.rpm}
      gear={tachometerData.gear}
      maxRpm={tachometerData.maxRpm}
      shiftRpm={tachometerData.shiftRpm}
      blinkRpm={tachometerData.blinkRpm}
      showRpmText={settings?.showRpmText ?? false}
      rpmOrientation={settings?.rpmOrientation ?? 'bottom'}
      gearRpmThresholds={tachometerData.gearRpmThresholds}
      ledColors={tachometerData.carData?.ledColor}
      carData={tachometerData.carData}
      carPath={tachometerData.carPath}
      shiftPointSettings={settings?.shiftPointSettings}
      opacity={settings?.background.opacity}
    />
  );
};
