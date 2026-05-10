import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';

export const usePlayerIconImage = (
  imageFilename: string | undefined
): string | null => {
  const { bridge } = useDashboard();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!imageFilename || !bridge) {
        if (!cancelled) setDataUrl(null);
        return;
      }
      const url = await bridge.getPlayerIconImageAsDataUrl(imageFilename);
      if (cancelled) return;
      if (!url) {
        setDataUrl(null);
        return;
      }

      // Pre-decode so the overlay doesn't flash a broken image on first paint.
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
