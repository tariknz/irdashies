import { useState, useEffect } from 'react';
import { useDashboardBridge } from '@irdashies/context';
import { validateImageDataUrl } from '@irdashies/utils/imageDataUrl';

const LOCALSTORAGE_KEY = 'input-steer-wheel-image';

export const useSteerWheelImage = (
  imageFilename: string | undefined
): string | null => {
  const bridge = useDashboardBridge();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!imageFilename) {
        if (!cancelled) setDataUrl(null);
        return;
      }

      if (imageFilename === 'browser-mode') {
        const stored = validateImageDataUrl(
          localStorage.getItem(LOCALSTORAGE_KEY)
        );
        if (!cancelled) setDataUrl(stored);
        return;
      }

      if (!bridge?.getPlayerIconImageAsDataUrl) {
        if (!cancelled) setDataUrl(null);
        return;
      }

      const url = validateImageDataUrl(
        await bridge.getPlayerIconImageAsDataUrl(imageFilename)
      );
      if (cancelled) return;
      if (!url) {
        setDataUrl(null);
        return;
      }

      const probe = new Image();
      probe.src = url;
      try {
        await probe.decode();
      } catch {
        await new Promise<void>((resolve) => {
          probe.onload = () => resolve();
          probe.onerror = () => resolve();
        });
      }

      if (!cancelled) setDataUrl(url);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [bridge, imageFilename]);

  return dataUrl;
};

export const STEER_WHEEL_IMAGE_STORAGE_KEY = LOCALSTORAGE_KEY;
