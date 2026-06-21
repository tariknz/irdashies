import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDashboard } from '@irdashies/context';

declare global {
  interface Window {
    profileSwitch?: {
      onTransition: (
        cb: (data: {
          hidden: boolean;
          name: string;
          showBanner?: boolean;
        }) => void
      ) => () => void;
    };
  }
}

interface ProfileSwitchOverlayProps {
  children: ReactNode;
}

// How long the profile name stays on screen after a switch.
const BANNER_MS = 1500;

/**
 * On a profile switch the main process hides the widgets, resizes the overlay
 * windows off-screen, then reveals them and shows the new profile name. This
 * component just toggles visibility on command and renders the name. `hidden`
 * uses visibility:hidden (Tailwind `invisible`) so the widget subtree isn't
 * painted while the windows resize — opacity alone doesn't reliably hide a
 * fixed-position subtree on a transparent overlay window, and visibility (vs
 * display:none) keeps layout so widgets don't re-measure on reveal.
 */
export const ProfileSwitchOverlay = ({
  children,
}: ProfileSwitchOverlayProps) => {
  const { containerBoundsInfo } = useDashboard();
  const [name, setName] = useState('');
  const [hidden, setHidden] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Windows shrink-wrap to their widget bounding box, so the renderer viewport
  // isn't the full screen. Center the banner on the display in window-local px:
  // display center (screen coords) minus the window's screen x. Fall back to
  // viewport-center if bounds aren't known yet.
  const display = containerBoundsInfo?.displayBounds;
  const win = containerBoundsInfo?.expected;
  const bannerLeft =
    display && win ? display.x + display.width / 2 - win.x : undefined;

  useEffect(() => {
    if (!window.profileSwitch?.onTransition) return;
    const unsub = window.profileSwitch.onTransition((data) => {
      if (data.name) setName(data.name);
      setHidden(data.hidden);
      if (!data.hidden && data.showBanner !== false) {
        setBannerVisible(true);
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(
          () => setBannerVisible(false),
          BANNER_MS
        );
      }
    });
    return () => {
      clearTimeout(bannerTimer.current);
      unsub();
    };
  }, []);

  return (
    <>
      <div className={hidden ? 'invisible' : ''}>{children}</div>
      {bannerVisible && (
        <div
          className="pointer-events-none fixed top-6 -translate-x-1/2 z-[9999]"
          style={{ left: bannerLeft ?? '50%' }}
        >
          <div className="px-8 py-4 rounded-xl bg-slate-900/85 text-white text-5xl font-bold tracking-wide shadow-2xl">
            {name}
          </div>
        </div>
      )}
    </>
  );
};
