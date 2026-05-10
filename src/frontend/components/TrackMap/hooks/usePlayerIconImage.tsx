import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';

/**
 * Loads the player icon as an HTMLImageElement so the TrackMap canvas can
 * draw it in a single ctx.drawImage call. Returning a decoded image (rather
 * than a data URL) keeps the hot path off React/DOM and lets drawDrivers do
 * the work alongside every other driver marker.
 */
export const usePlayerIconImage = (
  imageFilename: string | undefined
): HTMLImageElement | null => {
  const { bridge } = useDashboard();
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let img: HTMLImageElement | null = null;

    const load = async () => {
      if (!imageFilename || !bridge) {
        if (!cancelled) setImage(null);
        return;
      }
      const dataUrl = await bridge.getPlayerIconImageAsDataUrl(imageFilename);
      if (cancelled) return;
      if (!dataUrl) {
        setImage(null);
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
      if (!cancelled) setImage(img);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [bridge, imageFilename]);

  return image;
};
