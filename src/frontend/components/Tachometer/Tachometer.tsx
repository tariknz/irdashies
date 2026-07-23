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
      maxRpm={tachometerData.maxRpm}
      shiftRpm={tachometerData.shiftRpm}
      blinkRpm={tachometerData.blinkRpm}
      showRpmText={settings?.showRpmText ?? false}
      rpmOrientation={settings?.rpmOrientation ?? 'bottom'}
      gearRpmThresholds={tachometerData.gearRpmThresholds}
      ledColors={tachometerData.carData?.ledColor}
      carData={tachometerData.carData}
      opacity={settings?.background.opacity}
      showOilTemp={settings?.oilTemp?.enabled ?? true}
      showWaterTemp={settings?.waterTemp?.enabled ?? true}
      oilTempPosition={settings?.oilTemp?.position ?? 'top'}
      waterTempPosition={settings?.waterTemp?.position ?? 'top'}
      swapTempSides={settings?.tempLayout?.swapSides ?? false}
      oilEdgeOffset={settings?.oilTemp?.edgeOffset ?? 0}
      waterEdgeOffset={settings?.waterTemp?.edgeOffset ?? 0}
      oilTemp={tachometerData.oilTemp}
      waterTemp={tachometerData.waterTemp}
      engineWarnings={tachometerData.engineWarnings}
    />
  );
};
