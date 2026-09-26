import type {
  ReplayContextSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import {
  ReplayContextProcessor,
  detectReplayMode,
  type ArchiveIndex,
  type KnownUserIds,
} from './ReplayContextProcessor';
import logger from '../logger';

export interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export interface KnownUserIdRecorder extends KnownUserIds {
  remember(userId: number): boolean;
  load(): Promise<readonly number[]>;
}

export interface ReplayContextRuntimeOptions {
  /**
   * True for the real sim. False for demo data and irDashies tape playback,
   * whose user ids must not be remembered as this PC's.
   */
  isLiveSource: () => boolean;
}

const CHANNEL = 'replay.context';

/**
 * Hosts the replay context outside the ProcessorHost, like the incident
 * runtime: the incident and lap-history runtimes read it to pause recording,
 * so it must run whether or not a window is subscribed.
 */
export class ReplayContextRuntime {
  private readonly processor: ReplayContextProcessor;
  private subscribers = 0;
  private lastSessionKey = '';
  private readonly changeListeners = new Set<
    (snapshot: ReplayContextSnapshot) => void
  >();
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle,
    private readonly metrics: PerformanceSections,
    archive: ArchiveIndex,
    private readonly knownUserIds: KnownUserIdRecorder,
    private readonly options: ReplayContextRuntimeOptions
  ) {
    this.processor = new ReplayContextProcessor(archive, knownUserIds);
    this.disconnects = [
      this.processor.onChange((snapshot) => this.onChanged(snapshot)),
      lifecycle.onEnter((event) =>
        this.processor.onLifecycle({ type: 'enter', replay: event.replay })
      ),
      lifecycle.onDisconnect(() => {
        this.lastSessionKey = '';
        this.processor.onLifecycle({ type: 'disconnect' });
      }),
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== CHANNEL) return;
        const gained = count > 0 && this.subscribers === 0;
        this.subscribers = count;
        // The bus drops its cached snapshot when the last window leaves, and
        // this channel only publishes on change.
        if (gained) this.bus.publish(CHANNEL, this.processor.snapshot());
      }),
    ];
    knownUserIds
      .load()
      .then(() => this.processor.refresh())
      .catch((err) =>
        logger.warn('[ReplayContext] Failed to load known user ids:', err)
      );
  }

  onSession(session: Session): void {
    this.logSessionIdentity(session);
    this.processor.init(session);
    this.rememberLocalUser(session);
  }

  onFrame(frame: Telemetry): void {
    this.metrics.markStart('replayContextProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('replayContextProcessing');
  }

  snapshot(): ReplayContextSnapshot {
    return this.processor.snapshot();
  }

  /** False while a replay file is loaded that irDashies did not record. */
  canReadArchive(): boolean {
    const { mode, provenance } = this.processor.snapshot();
    return mode !== 'replayFile' || provenance === 'archived';
  }

  isReplayFile(): boolean {
    return this.processor.snapshot().mode === 'replayFile';
  }

  onChange(cb: (snapshot: ReplayContextSnapshot) => void): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  dispose(): void {
    this.disconnects.forEach((disconnect) => disconnect());
    this.disconnects.length = 0;
    this.changeListeners.clear();
  }

  /** Logs what the §4.1 spike needs to check, once per session identity. */
  private logSessionIdentity(session: Session): void {
    const simMode = session?.WeekendInfo?.SimMode;
    const subSessionId = session?.WeekendInfo?.SubSessionID?.toString() ?? '';
    const userId = session?.DriverInfo?.DriverUserID;
    const userKnown =
      typeof userId === 'number' && this.knownUserIds.has(userId);
    const key = `${simMode}|${subSessionId}|${userKnown}`;
    if (key === this.lastSessionKey) return;
    this.lastSessionKey = key;
    logger.info(
      `[ReplayContext] session simMode=${simMode ?? '(none)'} subSessionId=${subSessionId || '(none)'} userKnown=${userKnown} liveSource=${this.options.isLiveSource()}`
    );
  }

  private rememberLocalUser(session: Session): void {
    if (!this.options.isLiveSource()) return;
    const simMode = session?.WeekendInfo?.SimMode;
    if (
      detectReplayMode({ simMode, isReplayPlaying: false }) === 'replayFile'
    ) {
      return;
    }
    const userId = session?.DriverInfo?.DriverUserID;
    if (typeof userId !== 'number') return;
    this.knownUserIds.remember(userId);
  }

  private onChanged(snapshot: ReplayContextSnapshot): void {
    logger.info(
      `[ReplayContext] mode=${snapshot.mode} provenance=${snapshot.provenance} subSessionId=${snapshot.subSessionId || '(none)'} archivedSessions=[${snapshot.archivedSessionNums.join(',')}]`
    );
    this.bus.publish(CHANNEL, snapshot);
    for (const cb of this.changeListeners) {
      try {
        cb(snapshot);
      } catch (err) {
        logger.error('[ReplayContext] Change listener failed:', err);
      }
    }
  }
}
