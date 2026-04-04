import { useGarageCoverSettings } from './hooks/useGarageCoverSettings';
import { useGarageCoverImage } from './hooks/useGarageCoverImage';
import logoSvg from '../../assets/icons/logo.svg';
import { useTelemetryValue } from '@irdashies/context';

export const GarageCover = () => {
  const isInGarageDirect = useTelemetryValue<boolean>('IsInGarage') ?? false;
  const isGarageVisible =
    useTelemetryValue<boolean>('IsGarageVisible') ?? false;
  const cameraState = useTelemetryValue<number>('CamCameraState') ?? 0;

  // The session screen flag (0x01) is often set immediately when hitting
  // any of the main UI buttons (Garage, Standings, etc).
  // While not exclusive to the garage, combining it with IsInGarage or
  // IsGarageVisible can help trigger the cover during the transition.
  const isSessionScreen = (cameraState & 0x01) !== 0;

  const finalShow = isInGarageDirect || isGarageVisible || isSessionScreen;

  const settings = useGarageCoverSettings();
  const imageUrl = useGarageCoverImage(settings.imageFilename);

  if (!finalShow) {
    return <></>;
  }

  return (
    <div className="w-full h-full flex items-center justify-center rounded-sm bg-slate-800">
      <img
        src={imageUrl || logoSvg}
        alt="Garage Cover"
        className="w-full h-full object-contain"
      />
    </div>
  );
};
