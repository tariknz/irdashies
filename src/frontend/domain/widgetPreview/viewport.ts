export interface PreviewViewport {
  scale: number;
  pan: { x: number; y: number };
}

/** Keep the same widget point under the cursor while zooming the canvas. */
export function zoomPreviewAt(
  view: PreviewViewport,
  delta: number,
  anchor: { x: number; y: number }
): PreviewViewport {
  const scale = Math.min(
    4,
    Math.max(
      0.05,
      view.scale * Math.exp(-Math.max(-240, Math.min(240, delta)) * 0.0015)
    )
  );
  const ratio = scale / view.scale;
  return {
    scale,
    pan: {
      x: anchor.x - (anchor.x - view.pan.x) * ratio,
      y: anchor.y - (anchor.y - view.pan.y) * ratio,
    },
  };
}
