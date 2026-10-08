import type { ActiveSimulator } from '@irdashies/types';
import type { IrSdkSourceBridge } from '@irdashies/types';
import type { OverlayManager } from '../../../overlayManager';
import type { SessionLifecycle } from '../../../sessionLifecycle';
import type { ChannelBus } from '../../channelBridge';

/**
 * A cheap "is this sim running?" check, used only while auto-detection is
 * choosing between two or more simulators.
 *
 * It is deliberately separate from the bridge: probing must be able to start
 * and stop without building the full telemetry pipeline, because auto-detect
 * may poll for minutes before a sim appears.
 */
export interface SimProbe {
  /** Opens whatever handle the check needs. Safe to call repeatedly. */
  start(): void;
  /** True when the sim is running and publishing data worth reading. */
  isActive(): boolean;
  /** Releases the handle. Called once a simulator has been chosen. */
  stop(): void;
}

export type PublishSimEvents = (
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
) => Promise<IrSdkSourceBridge>;

/**
 * One telemetry source irDashies can read.
 *
 * Definitions are discovered by the registry rather than listed anywhere, so
 * adding a simulator means adding a directory under `sims/` — no switch
 * statement to extend and nothing to register by hand.
 *
 * The module holding a definition must stay cheap to import: the registry
 * loads every one of them eagerly to answer "which simulators does this build
 * support?", so the native modules belong behind `createProbe` and
 * `loadBridge`, never at module scope.
 */
export interface SimDefinition {
  id: ActiveSimulator;
  /**
   * Auto-detect order. The highest priority sim that is running wins, so a
   * sim that is easy to false-positive on should sit low.
   */
  priority: number;
  createProbe: () => Promise<SimProbe>;
  loadBridge: () => Promise<PublishSimEvents>;
}
