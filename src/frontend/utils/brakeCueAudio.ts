/**
 * Synthesised brake-countdown tones.
 *
 * Oscillator-based rather than sample-based: three beeps and a tone need no
 * asset, so there is nothing to bundle, nothing to resolve out of the asar, and
 * nothing for a future Content-Security-Policy to block.
 *
 * All three countdown beeps are the SAME pitch. A rising melody sounds nicer in
 * isolation but forces the driver to decode pitch to know which beep they just
 * heard; one pitch turns the countdown into a metronome, and rhythm is what
 * actually helps timing when you are busy. The brake tone is then unmistakable
 * because it differs in pitch, timbre and length at once.
 *
 * Note for the overlay: its windows are click-through when locked, so they never
 * receive a user gesture and Chromium would keep the context suspended. That is
 * handled by `autoplayPolicy` on the overlay BrowserWindow (see overlayManager),
 * not here.
 */

import {
  DEFAULT_AUDIO_OUTPUT_DEVICE_ID,
  type BrakeCueSound,
  type LapTraceSound,
} from '@irdashies/types';
import logger from './logger';

/**
 * Ceiling applied to the configured volume. A square wave at full scale is
 * genuinely painful on a headset, and this is an assist, not an alarm.
 */
const MASTER_HEADROOM = 0.35;

const ATTACK_SEC = 0.008;
const RELEASE_SEC = 0.05;

/**
 * exponentialRampToValueAtTime cannot reach zero, so the envelope ramps to a
 * near-silent floor instead. Ramping to 0 throws; jumping to 0 clicks.
 */
const SILENCE = 0.0001;

interface CueSpec {
  frequency: number;
  type: OscillatorType;
  durationSec: number;
  /** Relative level, before the master gain. */
  peak: number;
}

const CUES: Record<BrakeCueSound, CueSpec> = {
  count3: { frequency: 880, type: 'sine', durationSec: 0.07, peak: 1 },
  count2: { frequency: 880, type: 'sine', durationSec: 0.07, peak: 1 },
  count1: { frequency: 880, type: 'sine', durationSec: 0.07, peak: 1 },
  // Square/Triangle at an equal peak is perceptibly much louder, hence the lower level.
  brake: { frequency: 1100, type: 'triangle', durationSec: 0.18, peak: 0.6 },
};

let context: AudioContext | null = null;
let master: GainNode | null = null;
let warnedSuspended = false;
let warnedFailed = false;

/**
 * The output device the cues should use, and the one the live context is
 * already on. Kept as module state rather than a parameter of playBrakeCue:
 * switching sinks is asynchronous and per-context, so it must not happen on the
 * path of a cue that is meant to sound right now.
 */
let desiredSinkId: string = DEFAULT_AUDIO_OUTPUT_DEVICE_ID;
let appliedSinkId: string | null = null;

/** AudioContext.setSinkId is Chromium 110+; typings lag in some TS libs. */
type SinkCapableContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

/**
 * Route the live context at the selected device. A no-op until a context
 * exists — the desired id is remembered and applied when one is opened, so
 * enabling cues on a specific headset does not itself open an audio device.
 */
const applySinkId = (): void => {
  const ctx = context as SinkCapableContext | null;
  if (!ctx || typeof ctx.setSinkId !== 'function') return;
  if (appliedSinkId === desiredSinkId) return;
  // A brand-new context is already on the default device; only an explicit
  // switch away from it, or back to it, is worth a setSinkId call.
  const wasUnrouted = appliedSinkId === null;
  appliedSinkId = desiredSinkId;
  if (wasUnrouted && desiredSinkId === DEFAULT_AUDIO_OUTPUT_DEVICE_ID) return;

  // Web Audio spells "the system default device" as the empty string.
  const sinkId =
    desiredSinkId === DEFAULT_AUDIO_OUTPUT_DEVICE_ID ? '' : desiredSinkId;
  try {
    void ctx.setSinkId(sinkId).catch((error) => {
      // A device that has been unplugged since it was chosen. Chromium keeps
      // the previous sink, so the cues stay audible on the default device.
      logger.warn(
        '[LapTrace] Could not route brake cues to the selected audio device',
        error
      );
    });
  } catch (error) {
    logger.warn(
      '[LapTrace] Could not route brake cues to the selected audio device',
      error
    );
  }
};

/**
 * Choose which system playback device the cues use.
 * `DEFAULT_AUDIO_OUTPUT_DEVICE_ID` follows Windows' own default.
 */
export const setBrakeCueOutputDevice = (deviceId?: string): void => {
  const next = deviceId || DEFAULT_AUDIO_OUTPUT_DEVICE_ID;
  if (next === desiredSinkId) return;
  desiredSinkId = next;
  applySinkId();
};

const clampVolume = (volume: number): number => {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(Math.max(volume, 0), 1);
};

/**
 * The shared context, created on first use so a user who never enables cues
 * never opens an audio device. Null when Web Audio is unavailable (jsdom).
 */
const ensureContext = (): AudioContext | null => {
  if (context) return context;
  if (typeof AudioContext === 'undefined') return null;
  try {
    context = new AudioContext({ latencyHint: 'interactive' });
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    applySinkId();
    return context;
  } catch (error) {
    if (!warnedFailed) {
      warnedFailed = true;
      logger.warn(
        '[LapTrace] Could not open an audio context for brake cues',
        error
      );
    }
    return null;
  }
};

/**
 * Open and resume the context ahead of the first real cue, so the first beep of
 * a session is never the one paying for it.
 */
export const primeBrakeCueAudio = (): void => {
  const ctx = ensureContext();
  if (ctx && ctx.state !== 'running') void ctx.resume();
};

/**
 * Play one cue. Never throws — this is called from a rAF loop, and a device that
 * was unplugged mid-session must not be able to take the render loop with it.
 */
export const playBrakeCue = (
  sound: BrakeCueSound,
  volume: number,
  cues?: LapTraceSound
): void => {
  const level = clampVolume(volume);
  if (level <= 0) return;

  const ctx = ensureContext();
  if (!ctx || !master) return;

  // Resume without awaiting: awaiting would push the cue past the moment it is
  // meant to mark. If it lands in time the note plays, and if not we have lost
  // one beep rather than delayed every one of them.
  if (ctx.state !== 'running') {
    void ctx.resume();
    if (!warnedSuspended) {
      warnedSuspended = true;
      logger.warn(
        '[LapTrace] Brake cue audio context is suspended; the first cue may not sound'
      );
    }
  }

  try {
    // Fall back to the built-in tones when the caller passes no config.
    const spec = cues?.[sound] ?? CUES[sound];
    master.gain.value = level * MASTER_HEADROOM;

    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = spec.type;
    oscillator.frequency.value = spec.frequency;

    const startAt = ctx.currentTime + 0.001;
    const endAt = startAt + spec.durationSec;
    envelope.gain.setValueAtTime(SILENCE, startAt);
    envelope.gain.exponentialRampToValueAtTime(spec.peak, startAt + ATTACK_SEC);
    envelope.gain.setValueAtTime(
      spec.peak,
      Math.max(startAt + ATTACK_SEC, endAt - RELEASE_SEC)
    );
    envelope.gain.exponentialRampToValueAtTime(SILENCE, endAt);

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  } catch (error) {
    if (!warnedFailed) {
      warnedFailed = true;
      logger.warn('[LapTrace] Failed to play a brake cue', error);
    }
  }
};

/** Testing helper: drop the context so each spec starts clean. */
export const __resetBrakeCueAudioForTests = (): void => {
  context = null;
  master = null;
  warnedSuspended = false;
  warnedFailed = false;
  desiredSinkId = DEFAULT_AUDIO_OUTPUT_DEVICE_ID;
  appliedSinkId = null;
};
