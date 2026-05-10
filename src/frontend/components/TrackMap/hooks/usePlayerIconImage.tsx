import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';

export interface PlayerIconImage {
  image: HTMLImageElement;
  /**
   * True when the source is an animated format (currently GIF). The TrackMap
   * canvas needs to redraw every frame for the GIF to advance — without this
   * flag, ctx.drawImage just keeps capturing whatever frame happens to be
   * current at draw time and the icon appears frozen.
   */
  isAnimated: boolean;
}

/**
 * Loads the player icon as an HTMLImageElement so the TrackMap canvas can
 * draw it in a single ctx.drawImage call. Returning a decoded image (rather
 * than a data URL) keeps the hot path off React/DOM and lets drawDrivers do
 * the work alongside every other driver marker.
 */
export const usePlayerIconImage = (
  imageFilename: string | undefined
): PlayerIconImage | null => {
  const { bridge } = useDashboard();
  const [result, setResult] = useState<PlayerIconImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    let img: HTMLImageElement | null = null;

    const load = async () => {
      if (!imageFilename || !bridge) {
        if (!cancelled) setResult(null);
        return;
      }
      const dataUrl = await bridge.getPlayerIconImageAsDataUrl(imageFilename);
      if (cancelled) return;
      if (!dataUrl) {
        setResult(null);
        return;
      }
      img = new Image();
      img.src = dataUrl;
      try {
        await img.decode();
      } catch {
        // Some animated formats (e.g. some GIFs) don't support decode();
        // fall back to onload.
        await new Promise<void>((resolve) => {
          if (!img) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }
      if (!cancelled && img) {
        const isAnimated = dataUrl.startsWith('data:image/gif');
        setResult({ image: img, isAnimated });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [bridge, imageFilename]);

  return result;
};
