import { useGarageCoverSettings } from './hooks/useGarageCoverSettings';
import { useGarageCoverImage } from './hooks/useGarageCoverImage';
import logoSvg from '../../assets/icons/logo.svg';
import { useTelemetryValue } from '@irdashies/context';

export const GarageCover = () => {
  const isInGarageDirect = useTelemetryValue<boolean>('IsInGarage') ?? false;
  const isGarageVisible =
    useTelemetryValue<boolean>('IsGarageVisible') ?? false;

  // Combining both garage-specific flags ensures the fastest possible
  // detection of the garage screen without false positives from other
  // UI screens (like Standings).
  const finalShow = isInGarageDirect || isGarageVisible;

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
