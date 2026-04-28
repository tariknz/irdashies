import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';

export const usePlayerIconImage = (
  imageFilename: string | undefined
): string | null => {
  const { bridge } = useDashboard();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      if (!imageFilename || !bridge) {
        setImageUrl(null);
        return;
      }
      const dataUrl = await bridge.getPlayerIconImageAsDataUrl(imageFilename);
      if (!cancelled) setImageUrl(dataUrl);
    };

    loadImage();
    return () => {
      cancelled = true;
    };
  }, [bridge, imageFilename]);

  return imageUrl;
};
