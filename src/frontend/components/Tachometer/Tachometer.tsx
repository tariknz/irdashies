import { useTachometerData } from './hooks/useTachometerData';
import { useTachometerSettings } from './hooks/useTachometerSettings';
import { Tachometer as TachometerComponent } from './TachometerComponent/TachometerComponent';
import { useDrivingState, useSessionVisibility } from '@irdashies/context';

export const Tachometer = () => {
  const tachometerData = useTachometerData();
  const settings = useTachometerSettings();

  const { isDriving } = useDrivingState();

  const sessionVisible = useSessionVisibility(settings?.sessionVisibility);
  if (!sessionVisible) return <></>;

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
      showOilTemp={settings?.oilTemp?.enabled ?? true}
      showWaterTemp={settings?.waterTemp?.enabled ?? true}
      oilTempPosition={settings?.oilTemp?.position ?? 'top'}
      waterTempPosition={settings?.waterTemp?.position ?? 'top'}
      oilTemp={tachometerData.oilTemp}
      waterTemp={tachometerData.waterTemp}
      engineWarnings={tachometerData.engineWarnings}
    />
  );
};
