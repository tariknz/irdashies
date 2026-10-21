import type {
  ReplayContextSnapshot,
  ReplayMode,
  ReplayProvenance,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';
import logger from '../logger';

export interface ArchiveIndex {
  /** Session numbers archived on this PC for a SubSessionID. Empty when none. */
  has(subSessionId: string): Promise<number[]>;
}

export interface KnownUserIds {
  has(userId: number): boolean;
}

export interface ReplayModeInput {
  simMode: string | undefined;
  isReplayPlaying: boolean;
}

/**
 * The one place that decides what kind of source the sim is showing.
 * Assumes `WeekendInfo.SimMode` reads 'replay' only for a loaded replay file
 * (plan §4.1, not yet confirmed against real tapes).
 */
export const detectReplayMode = ({
  simMode,
  isReplayPlaying,
}: ReplayModeInput): ReplayMode => {
  if (simMode === 'replay') return 'replayFile';
  return isReplayPlaying ? 'spectating' : 'live';
};

/**
 * Every offline and test session reports SubSessionID 0, so 0 never names one
 * event. Its archive may belong to a different test session.
 */
export const isArchivableSubSessionId = (subSessionId: string): boolean =>
  subSessionId !== '' && subSessionId !== '0';

const toUserId = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;

const toSessionNums = (values: readonly unknown[]): number[] =>
  [
    ...new Set(
      values.filter(
        (value): value is number =>
          typeof value === 'number' && Number.isInteger(value) && value >= 0
      )
    ),
  ].sort((a, b) => a - b);

const sameNums = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const INITIAL: ReplayContextSnapshot = {
  mode: 'live',
  provenance: 'none',
  subSessionId: '',
  archivedSessionNums: [],
  version: 0,
};

/**
 * Tells live sessions, spectating and loaded replay files apart, and for a
 * replay file, where its event history can come from. Event-driven: the
 * snapshot only changes when the session identity, the replay flag or an
 * archive lookup changes it. Does no I/O; the archive and known users are
 * injected.
 */
export class ReplayContextProcessor implements TelemetryProcessor<
  ReplayContextSnapshot,
  'replay.context'
> {
  readonly channel = 'replay.context';
  readonly tickRateHz = 'event' as const;

  private simMode: string | undefined;
  private isReplayPlaying = false;
  private subSessionId = '';
  private userId: number | null = null;
  private archived: number[] = [];
  private lookupPending = false;
  /** Bumped per identity change so a late lookup cannot land on a new replay. */
  private lookupToken = 0;
  private latest: ReplayContextSnapshot = INITIAL;
  private readonly listeners = new Set<
    (snapshot: ReplayContextSnapshot) => void
  >();

  constructor(
    private readonly archive: ArchiveIndex,
    private readonly knownUserIds: KnownUserIds
  ) {}

  init(session: Session): void {
    const simMode = session?.WeekendInfo?.SimMode;
    const subSessionId = session?.WeekendInfo?.SubSessionID?.toString() ?? '';
    this.userId = toUserId(session?.DriverInfo?.DriverUserID);

    if (simMode !== this.simMode || subSessionId !== this.subSessionId) {
      this.simMode = simMode;
      this.subSessionId = subSessionId;
      this.startLookup();
    }
    this.update();
  }

  onFrame(frame: Telemetry): void {
    const isReplayPlaying = frame.IsReplayPlaying?.value?.[0] === true;
    if (isReplayPlaying === this.isReplayPlaying) return;
    this.isReplayPlaying = isReplayPlaying;
    this.update();
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'sessionNumChange') return;
    this.simMode = undefined;
    this.isReplayPlaying = false;
    this.subSessionId = '';
    this.userId = null;
    this.archived = [];
    this.lookupPending = false;
    this.lookupToken += 1;
    this.update();
  }

  /** Re-resolves provenance, for when the known user ids finish loading. */
  refresh(): void {
    this.update();
  }

  snapshot(): ReplayContextSnapshot {
    return this.latest;
  }

  onChange(listener: (snapshot: ReplayContextSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private mode(): ReplayMode {
    return detectReplayMode({
      simMode: this.simMode,
      isReplayPlaying: this.isReplayPlaying,
    });
  }

  private startLookup(): void {
    this.lookupToken += 1;
    this.archived = [];
    this.lookupPending = false;
    if (this.mode() !== 'replayFile') return;
    if (!isArchivableSubSessionId(this.subSessionId)) return;

    const token = this.lookupToken;
    this.lookupPending = true;
    this.archive
      .has(this.subSessionId)
      .catch((err: unknown) => {
        logger.warn('[ReplayContext] Archive lookup failed:', err);
        return [] as number[];
      })
      .then((sessionNums) => {
        if (token !== this.lookupToken) return;
        this.lookupPending = false;
        this.archived = toSessionNums(
          Array.isArray(sessionNums) ? sessionNums : []
        );
        this.update();
      });
  }

  private provenance(mode: ReplayMode): ReplayProvenance {
    if (mode !== 'replayFile') return 'none';
    if (this.lookupPending) return 'none';
    if (this.archived.length > 0) return 'archived';
    return this.userId !== null && this.knownUserIds.has(this.userId)
      ? 'localNotArchived'
      : 'foreign';
  }

  private update(): void {
    const mode = this.mode();
    const provenance = this.provenance(mode);
    const archivedSessionNums =
      provenance === 'archived' ? this.archived : INITIAL.archivedSessionNums;
    const previous = this.latest;
    if (
      previous.mode === mode &&
      previous.provenance === provenance &&
      previous.subSessionId === this.subSessionId &&
      sameNums(previous.archivedSessionNums, archivedSessionNums)
    ) {
      return;
    }
    this.latest = {
      mode,
      provenance,
      subSessionId: this.subSessionId,
      archivedSessionNums,
      version: previous.version + 1,
    };
    for (const listener of this.listeners) {
      try {
        listener(this.latest);
      } catch (err) {
        logger.error('[ReplayContext] Listener failed:', err);
      }
    }
  }
}
