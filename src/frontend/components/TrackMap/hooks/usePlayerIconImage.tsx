import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';

export interface PlayerIconImage {
  dataUrl: string;
  isAnimated: boolean;
}

export const usePlayerIconImage = (
  imageFilename: string | undefined
): PlayerIconImage | null => {
  const { bridge } = useDashboard();
  const [result, setResult] = useState<PlayerIconImage | null>(null);

  useEffect(() => {
    let cancelled = false;

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

      // Pre-decode so the overlay doesn't flash a broken image on first paint.
      const probe = new Image();
      probe.src = dataUrl;
      try {
        await probe.decode();
      } catch {
        await new Promise<void>((resolve) => {
          probe.onload = () => resolve();
          probe.onerror = () => resolve();
        });
      }

      if (!cancelled) {
        setResult({
          dataUrl,
          isAnimated: dataUrl.startsWith('data:image/gif'),
        });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [bridge, imageFilename]);

  return result;
};
