import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';

export const useGarageCoverImage = (
  imageFilename: string | undefined
): string | null => {
  const { bridge } = useDashboard();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageFilename || !bridge) {
      return;
    }

    const loadImage = async () => {
      const dataUrl = await bridge.getGarageCoverImageAsDataUrl(imageFilename);
      setImageUrl(dataUrl);
    };

    loadImage();
  }, [bridge, imageFilename]);

  return imageUrl;
};
