import { useState, useEffect } from 'react';
import { useGarageCoverSettings } from './hooks/useGarageCoverSettings';
import { useGarageCoverImage } from './hooks/useGarageCoverImage';
import logoSvg from '../../assets/icons/logo.svg';
import type { TrackStateSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { useDashboard, useTrackStateSelector } from '@irdashies/context';
import { useDemoFrame } from '@irdashies/utils/useDemoFrame';

/** Visible for 5s, hidden for 3s so the cover can be placed in demo mode. */
const getDemoGarageVisible = (elapsedSec = 0): boolean => elapsedSec % 8 < 5;

const EMPTY_GARAGE_STATE: readonly [boolean, boolean, boolean] = [
  false,
  false,
  false,
];

const selectGarageState = (snapshot: TrackStateSnapshot) =>
  [snapshot.isInGarage, snapshot.isGarageVisible, snapshot.isOnTrack] as const;

export const GarageCover = () => {
  const { isDemoMode } = useDashboard();
  const demoVisible = useDemoFrame(isDemoMode, getDemoGarageVisible);
  const [isInGarageDirect, isGarageVisible, isOnTrack] =
    useTrackStateSelector(selectGarageState, { equality: shallow }) ??
    EMPTY_GARAGE_STATE;

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
    if (isDemoMode) return;
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
  }, [finalShow, isOnTrack, isDemoMode]);

  const settings = useGarageCoverSettings();
  const imageUrl = useGarageCoverImage(settings.imageFilename);

  if (isDemoMode ? !demoVisible : !actuallyShow) {
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
