import type {
  Incident,
  IncidentThresholds,
  Session,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { IncidentProcessor } from './IncidentProcessor';
import logger from '../logger';

export interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export interface IncidentPersistence {
  save(sessionId: string, incident: Incident): void;
}

export interface IncidentRuntimeOptions {
  isDev?: boolean;
}

export class IncidentRuntime {
  private readonly processor: IncidentProcessor;
  private currentSessionId = '';
  private readonly sessionIdChangeListeners = new Set<(id: string) => void>();
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle,
    private readonly metrics: PerformanceSections,
    private readonly persistence: IncidentPersistence,
    options: IncidentRuntimeOptions = {}
  ) {
    // Unlike FuelProjectionRuntime, this processor is created eagerly and runs
    // on every frame regardless of channel subscriber count — gating on
    // subscribers would stop incident detection/persistence whenever the
    // Gantry window is closed, which is a regression, not an optimisation.
    this.processor = new IncidentProcessor({ isDev: options.isDev ?? false });
    this.disconnects = [
      lifecycle.onEnter((event) =>
        this.processor.onLifecycle({ type: 'enter', replay: event.replay })
      ),
      lifecycle.onSessionNumChange(() =>
        this.processor.onLifecycle({ type: 'sessionNumChange' })
      ),
      lifecycle.onDisconnect(() => this.onDisconnect()),
    ];
  }

  onSession(session: Session): void {
    this.processor.init(session);
    const sessionId = session?.WeekendInfo?.SubSessionID?.toString() ?? '';
    if (sessionId && sessionId !== this.currentSessionId) {
      logger.info(
        `[RaceControl] session changed: ${this.currentSessionId || '(none)'} -> ${sessionId}`
      );
      this.currentSessionId = sessionId;
      this.sessionIdChangeListeners.forEach((cb) => cb(sessionId));
    }
  }

  onFrame(frame: Telemetry): void {
    this.metrics.markStart('incidentProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('incidentProcessing');

    this.metrics.markStart('incidentPublication');
    for (const incident of this.processor.snapshot()) {
      logger.info(
        `[RaceControl] incident emitted type=${incident.type} car=${incident.carIdx} (${incident.driverName} #${incident.carNumber}) lap=${incident.lapNum} lapDistPct=${incident.lapDistPct.toFixed(3)} sessionTime=${incident.sessionTime.toFixed(2)} id=${incident.id}`
      );
      this.bus.publish('raceControl.incidents', incident);
      this.persistence.save(this.currentSessionId, incident);
    }
    this.metrics.markEnd('incidentPublication');
  }

  updateThresholds(thresholds: IncidentThresholds): void {
    this.processor.updateThresholds(thresholds);
  }

  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  onSessionIdChanged(cb: (sessionId: string) => void): () => void {
    this.sessionIdChangeListeners.add(cb);
    return () => this.sessionIdChangeListeners.delete(cb);
  }

  dispose(): void {
    this.disconnects.forEach((disconnect) => disconnect());
  }

  private onDisconnect(): void {
    this.processor.onLifecycle({ type: 'disconnect' });
    this.currentSessionId = '';
  }
}
