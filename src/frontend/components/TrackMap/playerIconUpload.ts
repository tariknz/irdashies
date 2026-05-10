// Biggest player circle radius supported by the slider is 100px (200px
// diameter), drawn into a HiDPI canvas (~2x). 512 gives that headroom while
// still being small enough that ctx.drawImage stays cheap on every tick.
export const MAX_ICON_DIMENSION = 512;

export const dataUrlToBuffer = (dataUrl: string): Uint8Array =>
  Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));

const decodeImage = async (dataUrl: string): Promise<HTMLImageElement> => {
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
  } catch {
    // decode() isn't supported for some animated formats; fall back to onload.
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }
  return img;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

/**
 * Shrinks an uploaded icon to MAX_ICON_DIMENSION before it's persisted, so the
 * canvas drawImage hot path stays fast on cheap GPUs. SVGs are vector and
 * already-small rasters (e.g. small animated GIFs) pass through untouched.
 *
 * Returns the buffer to upload and a data URL suitable for the localStorage
 * fallback. Reuses the original data when no resize is needed.
 *
 * Animated GIFs above the cap collapse to a single frame here — that's the
 * only practical way to fix the perf issue at the source without pulling in a
 * GIF re-encoder.
 */
export const prepareIconForUpload = async (
  file: File,
  originalDataUrl: string
): Promise<{ buffer: Uint8Array; dataUrl: string }> => {
  const passthrough = () => ({
    buffer: dataUrlToBuffer(originalDataUrl),
    dataUrl: originalDataUrl,
  });

  if (file.type === 'image/svg+xml') {
    return passthrough();
  }

  const img = await decodeImage(originalDataUrl);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h || (w <= MAX_ICON_DIMENSION && h <= MAX_ICON_DIMENSION)) {
    return passthrough();
  }

  const scale = Math.min(MAX_ICON_DIMENSION / w, MAX_ICON_DIMENSION / h);
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return passthrough();
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Encode as PNG to preserve transparency; the marker is rendered over the
  // track so alpha matters more than file size at this resolution.
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) return passthrough();

  const buffer = new Uint8Array(await blob.arrayBuffer());
  const dataUrl = await blobToDataUrl(blob);
  return { buffer, dataUrl };
};
