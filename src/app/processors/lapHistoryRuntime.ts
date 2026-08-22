import type { LapHistorySnapshot, Session, Telemetry } from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { LapHistoryProcessor } from './LapHistoryProcessor';
import logger from '../logger';

export interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

/** Writes stored crossings into a snapshot. Returns false when they do not fit. */
export type LapHistoryRestore = (target: LapHistorySnapshot) => boolean;

export interface StoredLapHistory {
  /** Session number the crossings were recorded in. */
  sessionNum: number | null;
  apply: LapHistoryRestore;
}

export interface LapHistoryPersistence {
  save(sessionId: string, snapshot: LapHistorySnapshot): void;
  /** Reads stored crossings. The runtime decides when to apply them. */
  load(sessionId: string): Promise<StoredLapHistory | null>;
}

const CHANNEL = 'lap-history.snapshot';

const hasCrossings = (snapshot: LapHistorySnapshot): boolean =>
  snapshot.count.some((count) => count > 0);

export class LapHistoryRuntime {
  private readonly processor: LapHistoryProcessor;
  private enabled = true;
  private currentSessionId = '';
  private lastPublishedVersion = -1;
  private subscribers = 0;
  /** Bumped per session change so a late disk read cannot land on a new race. */
  private restoreToken = 0;
  private restorePending = false;
  private pendingRestore: StoredLapHistory | null = null;
  private readonly sessionIdChangeListeners = new Set<(id: string) => void>();
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle,
    private readonly metrics: PerformanceSections,
    private readonly persistence: LapHistoryPersistence
  ) {
    // Subscriber count does not gate this processor: an enabled Gantry keeps
    // recording laps when its window is closed. The dashboard enabled state is
    // handled separately so users who never enable Gantry pay no frame cost.
    // Delivery stays demand-gated - the bus only sends to subscribed windows.
    this.processor = new LapHistoryProcessor();
    this.disconnects = [
      lifecycle.onEnter((event) =>
        this.processor.onLifecycle({ type: 'enter', replay: event.replay })
      ),
      lifecycle.onSessionNumChange(() =>
        this.processor.onLifecycle({ type: 'sessionNumChange' })
      ),
      lifecycle.onDisconnect(() => this.onDisconnect()),
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== CHANNEL) return;
        const gained = count > 0 && this.subscribers === 0;
        this.subscribers = count;
        if (gained) this.resend();
      }),
    ];
  }

  onSession(session: Session): void {
    this.processor.init(session);
    const sessionId = session?.WeekendInfo?.SubSessionID?.toString() ?? '';
    if (sessionId === this.currentSessionId) return;
    logger.info(
      `[LapHistory] session changed: ${this.currentSessionId || '(none)'} -> ${sessionId || '(none)'}`
    );
    this.currentSessionId = sessionId;
    this.load(sessionId);
    this.sessionIdChangeListeners.forEach((cb) => cb(sessionId));
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled) return;
    this.metrics.markStart('lapHistoryProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('lapHistoryProcessing');
    this.applyPendingRestore();
    this.publish(false);
  }

  updateEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    // Re-baseline: lap counters moved on while recording was off.
    this.processor.onLifecycle({ type: 'enter', replay: false });
  }

  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  snapshot(): LapHistorySnapshot {
    return this.processor.snapshot();
  }

  onSessionIdChanged(cb: (sessionId: string) => void): () => void {
    this.sessionIdChangeListeners.add(cb);
    return () => this.sessionIdChangeListeners.delete(cb);
  }

  dispose(): void {
    this.disconnects.forEach((disconnect) => disconnect());
    this.disconnects.length = 0;
  }

  private load(sessionId: string): void {
    this.restoreToken += 1;
    const token = this.restoreToken;
    this.pendingRestore = null;
    if (!sessionId) {
      this.restorePending = false;
      return;
    }
    this.restorePending = true;
    this.persistence
      .load(sessionId)
      .then((stored) => {
        if (token !== this.restoreToken) return;
        this.pendingRestore = stored;
      })
      .catch((err) =>
        logger.warn('[LapHistory] Failed to read stored lap history:', err)
      )
      .finally(() => {
        if (token === this.restoreToken) this.restorePending = false;
      });
  }

  /**
   * Runs after a frame, never before one. The processor rebaselines on its
   * first frame of a session, which would wipe anything restored earlier.
   */
  private applyPendingRestore(): void {
    const stored = this.pendingRestore;
    if (!stored) return;
    this.pendingRestore = null;

    const snapshot = this.processor.snapshot();
    // Laps recorded while the read was in flight win over the file.
    if (hasCrossings(snapshot)) return;
    if (stored.sessionNum !== snapshot.sessionNum) return;

    const liveSessionNum = snapshot.sessionNum;
    if (!stored.apply(snapshot)) return;
    snapshot.sessionNum = liveSessionNum;
    logger.info(
      `[LapHistory] restored recorded laps for session ${this.currentSessionId}`
    );
    this.publish(true);
  }

  private publish(force: boolean): void {
    const snapshot = this.processor.snapshot();
    if (!force && snapshot.version === this.lastPublishedVersion) return;
    this.lastPublishedVersion = snapshot.version;

    this.metrics.markStart('lapHistoryPublication');
    this.bus.publish(CHANNEL, snapshot);
    // An empty snapshot would erase a race the app is about to reload, so a
    // reset never reaches disk and a pending read is left to finish first.
    if (
      this.currentSessionId &&
      !this.restorePending &&
      hasCrossings(snapshot)
    ) {
      this.persistence.save(this.currentSessionId, snapshot);
    }
    this.metrics.markEnd('lapHistoryPublication');
  }

  /**
   * Pushes the recorded race to a window that has just subscribed.
   *
   * The bus drops its cached snapshot once the last subscriber leaves, and this
   * channel only publishes when a lap is completed. After the last car
   * finishes, no further publish is ever due - so a window that resubscribes,
   * such as the Gantry returning to the Lap Graph tab, would otherwise wait
   * forever for the race it just recorded. Deliberately does not touch
   * lastPublishedVersion or write to disk: nothing has changed, this is a
   * redelivery of what the bus already had.
   */
  private resend(): void {
    const snapshot = this.processor.snapshot();
    if (!hasCrossings(snapshot)) return;
    this.metrics.markStart('lapHistoryPublication');
    this.bus.publish(CHANNEL, snapshot);
    this.metrics.markEnd('lapHistoryPublication');
  }

  private onDisconnect(): void {
    this.processor.onLifecycle({ type: 'disconnect' });
    this.currentSessionId = '';
    this.restoreToken += 1;
    this.restorePending = false;
    this.pendingRestore = null;
  }
}
