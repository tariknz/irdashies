import { useEffect, useState } from 'react';
import type { TrackDrawing } from './trackDrawing';
import { loadTrackDrawing } from './trackDrawingLoader';

/** Undefined disables loading, e.g. when the widget is hidden or disconnected. */
export const useTrackDrawing = (trackId: number | undefined) => {
  const [loaded, setLoaded] = useState<{
    trackId: number;
    drawing: TrackDrawing | null;
  } | null>(null);

  useEffect(() => {
    if (trackId === undefined) return;
    let cancelled = false;
    void loadTrackDrawing(trackId).then((drawing) => {
      if (!cancelled) setLoaded({ trackId, drawing });
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  // Never show the old track while its replacement is loading.
  return loaded && loaded.trackId === trackId ? loaded.drawing : null;
};
