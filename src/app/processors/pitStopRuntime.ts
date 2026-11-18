import type { PitStopRecord, Session, Telemetry } from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBus';
import type { SessionLifecycle } from '../sessionLifecycle';
import type { PerformanceSections } from './lapHistoryRuntime';
import { PitStopProcessor } from './PitStopProcessor';
import logger from '../logger';

export interface PitStopSessionKey {
  subSessionId: number;
  sessionNum: number;
}

export interface PitStopPersistence {
  load(key: PitStopSessionKey): Promise<PitStopRecord[] | null>;
  save(key: PitStopSessionKey, stops: readonly PitStopRecord[]): void;
}

const CHANNEL = 'pit-stops.snapshot';

/**
 * Hosts pit stop recording outside the ProcessorHost, the way lap history is
 * hosted: an enabled Gantry keeps recording while its window is closed, and a
 * user who never enables it pays no frame cost. Finished stops are saved per
 * session so a restart mid-race keeps them.
 */
export class PitStopRuntime {
  private readonly processor = new PitStopProcessor();
  private enabled = true;
  private replayPaused = false;
  private lastPublishedVersion = -1;
  private lastSavedVersion = -1;
  private subscribers = 0;
  /** The session a restore was last started for. */
  private restoreKey = '';
  private restorePending = false;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle,
    private readonly metrics: PerformanceSections,
    private readonly persistence: PitStopPersistence
  ) {
    this.disconnects = [
      lifecycle.onDisconnect(() => {
        this.processor.onLifecycle({ type: 'disconnect' });
        this.publish(false);
      }),
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== CHANNEL) return;
        const gained = count > 0 && this.subscribers === 0;
        this.subscribers = count;
        if (gained) this.publish(true);
      }),
    ];
  }

  onSession(session: Session): void {
    const previous = this.processor.snapshot().subSessionId;
    this.processor.init(session);
    if (this.processor.snapshot().subSessionId !== previous) {
      // A restore still loading belongs to the previous event.
      this.restoreKey = '';
      this.restorePending = false;
    }
    this.publish(false);
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled || this.replayPaused) return;
    this.metrics.markStart('pitStopProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('pitStopProcessing');
    this.restoreIfNewSession();
    this.publish(false);
  }

  updateEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    // Re-baseline: cars moved on while recording was off.
    this.processor.onLifecycle({ type: 'enter', replay: false });
  }

  /** Pauses while an iRacing replay file is loaded; scrubbing is not racing. */
  updateReplayPaused(paused: boolean): void {
    if (paused === this.replayPaused) return;
    this.replayPaused = paused;
    if (!paused) this.processor.onLifecycle({ type: 'enter', replay: false });
  }

  dispose(): void {
    this.disconnects.forEach((disconnect) => disconnect());
    this.disconnects.length = 0;
  }

  private currentKey(): PitStopSessionKey | null {
    const { subSessionId, sessionNum } = this.processor.snapshot();
    return subSessionId !== null && sessionNum !== null
      ? { subSessionId, sessionNum }
      : null;
  }

  private currentKeyId(): string | null {
    const key = this.currentKey();
    return key ? `${key.subSessionId}:${key.sessionNum}` : null;
  }

  private restoreIfNewSession(): void {
    const key = this.currentKey();
    const id = this.currentKeyId();
    if (!key || !id || id === this.restoreKey) return;
    this.restoreKey = id;
    this.restorePending = true;
    this.persistence
      .load(key)
      .then((stops) => {
        if (id !== this.restoreKey || id !== this.currentKeyId() || !stops)
          return;
        if (this.processor.restore(stops)) {
          logger.info(
            `[PitStops] restored ${stops.length} stops for session ${id}`
          );
          this.publish(true);
        }
      })
      .catch((err) =>
        logger.warn('[PitStops] Failed to read stored pit stops:', err)
      )
      .finally(() => {
        if (id !== this.restoreKey) return;
        this.restorePending = false;
        this.save();
      });
  }

  private publish(force: boolean): void {
    const snapshot = this.processor.snapshot();
    if (!force && snapshot.version === this.lastPublishedVersion) return;
    this.lastPublishedVersion = snapshot.version;
    this.metrics.markStart('pitStopPublication');
    this.bus.publish(CHANNEL, snapshot);
    this.metrics.markEnd('pitStopPublication');
    this.save();
  }

  /** Writes on any change; the store debounces and drops stops in progress. */
  private save(): void {
    if (this.restorePending) return;
    const key = this.currentKey();
    if (!key) return;
    const { stops, version } = this.processor.snapshot();
    if (version === this.lastSavedVersion) return;
    this.lastSavedVersion = version;
    if (stops.some((stop) => stop.exitTime !== null))
      this.persistence.save(key, stops);
  }
}
