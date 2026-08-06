import { ipcMain } from 'electron';
import type { OverlayManager } from '../overlayManager';

export const LEGACY_STREAM_SUBSCRIBE = 'legacy-stream:subscribe';
export const LEGACY_STREAM_UNSUBSCRIBE = 'legacy-stream:unsubscribe';

export type LegacyRendererStream = 'telemetry' | 'sessionData';

const isLegacyRendererStream = (
  value: unknown
): value is LegacyRendererStream =>
  value === 'telemetry' || value === 'sessionData';

export const setupLegacyRendererSubscriptions = (
  overlayManager: OverlayManager
): void => {
  ipcMain.handle(LEGACY_STREAM_SUBSCRIBE, (event, stream: unknown) => {
    if (!isLegacyRendererStream(stream)) {
      throw new Error('Invalid legacy renderer stream');
    }
    overlayManager.subscribeLegacyStream(event.sender.id, stream);
  });
  ipcMain.handle(LEGACY_STREAM_UNSUBSCRIBE, (event, stream: unknown) => {
    if (!isLegacyRendererStream(stream)) {
      throw new Error('Invalid legacy renderer stream');
    }
    overlayManager.unsubscribeLegacyStream(event.sender.id, stream);
  });
};
