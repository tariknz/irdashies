import { useDrivingState, useSessionVisibility } from '@irdashies/context';
import { ShiftLightsComponent } from './components/ShiftLightsComponent';
import { useShiftLightsData } from './hooks/useShiftLightsData';
import { useShiftLightsSettings } from './hooks/useShiftLightsSettings';

export const ShiftLights = () => {
  const data = useShiftLightsData();
  const settings = useShiftLightsSettings();
  const { isDriving } = useDrivingState();
  const sessionVisible = useSessionVisibility(settings.sessionVisibility);

  if (!sessionVisible || (settings.showOnlyWhenOnTrack && !isDriving)) {
    return null;
  }

  return (
    <ShiftLightsComponent
      rpm={data.rpm}
      gear={data.gear}
      carId={data.carData?.carId}
      carPath={data.carPath}
      shiftPointSettings={settings.shiftPointSettings}
      opacity={settings.background.opacity}
    />
  );
};
