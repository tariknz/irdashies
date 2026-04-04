import { useState, useEffect } from 'react';
import { useGarageCoverSettings } from './hooks/useGarageCoverSettings';
import { useGarageCoverImage } from './hooks/useGarageCoverImage';
import logoSvg from '../../assets/icons/logo.svg';
import { useTelemetryValue } from '@irdashies/context';

export const GarageCover = () => {
  const isInGarageDirect = useTelemetryValue<boolean>('IsInGarage') ?? false;
  const isGarageVisible =
    useTelemetryValue<boolean>('IsGarageVisible') ?? false;
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;

  // Combining both garage-specific flags ensures the fastest possible
  // detection of the garage screen without false positives from other
  // UI screens (like Standings).
  const finalShow = isInGarageDirect || isGarageVisible;

  // Hysteresis/Debounce logic to prevent "flashing" during exit
  // Initialize with the current calculated state
  const [actuallyShow, setActuallyShow] = useState(
    () => finalShow && !isOnTrack
  );

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isOnTrack) {
      // Force-hide immediately (deferred to next tick to satisfy ESLint)
      timer = setTimeout(() => setActuallyShow(false), 0);
    } else if (finalShow) {
      // Show immediately (deferred to next tick to satisfy ESLint)
      timer = setTimeout(() => setActuallyShow(true), 0);
    } else {
      // Delayed hide to bridge telemetry flickers
      timer = setTimeout(() => setActuallyShow(false), 500);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [finalShow, isOnTrack]);

  const settings = useGarageCoverSettings();
  const imageUrl = useGarageCoverImage(settings.imageFilename);

  return (
    <div
      className={[
        'w-full h-full flex items-center justify-center rounded-sm bg-slate-800 transition-opacity duration-200',
        actuallyShow ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      <img
        src={imageUrl || logoSvg}
        alt="Garage Cover"
        className="w-full h-full object-contain"
      />
    </div>
  );
};
