import { useEffect, useState } from 'react';
import logger from '@irdashies/utils/logger';

export interface AudioOutputDevice {
  /** `MediaDeviceInfo.deviceId`, the value AudioContext.setSinkId takes. */
  deviceId: string;
  /** The Windows device name, e.g. "Speakers (Realtek Audio)". */
  label: string;
}

/**
 * The system's audio playback devices, refreshed when one is plugged or
 * unplugged.
 *
 * Chromium lists a synthetic 'default' (and sometimes 'communications') entry
 * that tracks the current Windows default. Both are dropped here — the picker
 * offers its own "Default" option, and showing a second one that means the same
 * thing only invites the user to wonder which is which.
 *
 * Labels come back empty unless the page holds microphone permission. Electron
 * grants permission checks by default, so they are populated in the app; the
 * fallback names keep the picker usable if that ever changes.
 */
export const useAudioOutputDevices = (
  enabled: boolean
): AudioOutputDevice[] => {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;

    let cancelled = false;
    const refresh = () => {
      media
        .enumerateDevices()
        .then((all) => {
          if (cancelled) return;
          setDevices(
            all
              .filter(
                (device) =>
                  device.kind === 'audiooutput' &&
                  device.deviceId !== '' &&
                  device.deviceId !== 'default' &&
                  device.deviceId !== 'communications'
              )
              .map((device, index) => ({
                deviceId: device.deviceId,
                label: device.label || `Audio output ${index + 1}`,
              }))
          );
        })
        .catch((error) => {
          logger.warn('[LapTrace] Could not list audio output devices', error);
        });
    };

    refresh();
    media.addEventListener?.('devicechange', refresh);
    return () => {
      cancelled = true;
      media.removeEventListener?.('devicechange', refresh);
    };
  }, [enabled]);

  return devices;
};
