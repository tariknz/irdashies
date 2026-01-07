import { useGarageCoverSettings } from './hooks/useGarageCoverSettings';
import { useGarageCoverImage } from './hooks/useGarageCoverImage';
import logoSvg from '../../assets/icons/logo.svg';
import { useTelemetryValue } from '@irdashies/context';

export const GarageCover = () => {
  const isInGarage = useTelemetryValue('IsInGarage');
  const settings = useGarageCoverSettings();
  const imageUrl = useGarageCoverImage(settings.imageFilename);

  if (!isInGarage) {
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
