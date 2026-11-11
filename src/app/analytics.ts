import { PostHog } from 'posthog-node';
import type { EventMessage, IdentifyMessage } from 'posthog-node';
import { app, screen } from 'electron';
import { physicalScreenSize } from './analytics/screenResolution';
import os from 'node:os';
import crypto from 'node:crypto';
import type { ActiveSimulator, DashboardLayout } from '@irdashies/types';
import { readData, writeData } from './storage/storage';
import {
  readRadarPoleSideReportHash,
  writeRadarPoleSideReportHash,
} from './storage/radarPoleSideReportHash';
import { getAnalyticsOptOut } from './storage/analytics';
import { serializeLogArgs, MAX_LOG_JSON_LENGTH } from '@irdashies/types';
import { createLogPathScrubber } from './analytics/logMessage';
import logger from './logger';
import type ElectronLog from 'electron-log';
import type { LogMessage } from 'electron-log';
import { readPitLaneCalibrationForAnalytics } from './analytics/pitLaneCalibration';
import {
  MAX_POLE_SIDE_PROPERTIES_BYTES,
  buildRadarPoleSideReport,
} from './analytics/radarPoleSideReport';
import {
  loadRadarPoleSideOverrides,
  radarPoleSideOverrides,
} from './storage/radarPoleSideOverrides';
import {
  readPitLaneAnalyticsCheckpoint,
  writePitLaneAnalyticsCheckpoint,
} from './storage/pitLaneAnalyticsCheckpoint';
import { getSimulatorUsageStore } from './storage/simulatorUsage';
import {
  buildSimulatorUsageProperties,
  type SimulatorUsageProperties,
} from './analytics/simulatorUsageReport';

declare const POSTHOG_KEY: string;

/**
 * How long after the last flip the radar pole side report goes out, so a
 * burst of key presses is one report and nothing waits for the next launch.
 */
const POLE_SIDE_REPORT_DELAY_MS = 60 * 1000;

const DEDUP_WINDOW_MS = 60 * 60 * 1000;
const DEDUP_KEY_LENGTH = 30;
const DEDUP_MAX_ENTRIES = 5000;
const MAX_CALIBRATION_PROPERTIES_BYTES = 512 * 1024;

/**
 * Names the connected simulator on an exception PostHog captured by itself,
 * as warnings and errors forwarded from the log are. Other events pass as
 * they are.
 */
export const withSimulatorOnException = (
  event: EventMessage,
  simulator: ActiveSimulator | undefined
): EventMessage =>
  event.event === '$exception'
    ? {
        ...event,
        properties: { ...event.properties, simulator: simulator ?? null },
      }
    : event;

export interface AnalyticsProvider {
  capture(event: EventMessage): void;
  captureConfirmed(event: EventMessage): Promise<void>;
  identify(message: IdentifyMessage): void;
  shutdown(shutdownTimeoutMs?: number): void;
}

export class PostHogProvider implements AnalyticsProvider {
  constructor(private posthog: PostHog) {}

  capture(event: EventMessage): void {
    this.posthog.capture(event);
  }

  async captureConfirmed(event: EventMessage): Promise<void> {
    if (!event.uuid || this.posthog.isDisabled || this.posthog.optedOut) {
      throw new Error('Analytics event cannot be delivered');
    }
    let confirmed = false;
    // captureImmediate swallows HTTP failures in the installed SDK. Public
    // flush reports successful messages; require our UUID, not just an empty
    // queue or a resolved promise, before recording a delivery checkpoint.
    const unsubscribe = this.posthog.on('flush', (messages: unknown) => {
      if (
        Array.isArray(messages) &&
        messages.some(
          (message: unknown) =>
            typeof message === 'object' &&
            message !== null &&
            'uuid' in message &&
            message.uuid === event.uuid
        )
      ) {
        confirmed = true;
      }
    });
    try {
      this.posthog.capture(event);
      await this.posthog.flush();
      if (!confirmed) throw new Error('Analytics event was not acknowledged');
    } finally {
      unsubscribe();
    }
  }

  identify(message: IdentifyMessage): void {
    this.posthog.identify(message);
  }

  shutdown(shutdownTimeoutMs?: number): void {
    this.posthog.shutdown(shutdownTimeoutMs);
  }
}

export class Analytics {
  private provider: AnalyticsProvider | null = null;
  private userId: string | undefined;
  private pendingUserId: string | undefined;
  private pitLaneCalibrationAttempted = false;
  private pitLaneCalibrationTask: Promise<void> | undefined;
  private radarPoleSideTask: Promise<void> | undefined;
  private poleSideEvent: { hash: string; uuid: string } | undefined;
  private radarPoleSideTimer: ReturnType<typeof setTimeout> | undefined;
  private watchingRadarPoleSides = false;
  private startupIdentifyTask: Promise<void> | undefined;
  /**
   * The simulator whose bridge reports it running, or none. Followed even
   * while opted out, so opting back in can start counting a sim that is
   * already up.
   */
  private connectedSimulator: ActiveSimulator | undefined;
  /**
   * Whether the sim shows the track: in the car, a replay, spectating or
   * LMU's monitor. Only that time counts as use, not menus or the garage.
   */
  private watchingTrack = false;

  constructor(provider?: AnalyticsProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      this.initialize();
    }
  }

  private initialize(): void {
    const optOut = getAnalyticsOptOut();
    if (optOut === true) {
      logger.warn(
        '[Analytics] Analytics opt-out is enabled, skipping initialization'
      );
      // Normally deleted at the opt-out; this catches a delete that failed.
      void getSimulatorUsageStore().clear();
      return;
    }
    // POSTHOG_KEY is defined at build time via Vite's define option
    const key: string = POSTHOG_KEY || '';

    if (!key) {
      return;
    }

    const posthog = new PostHog(key, {
      host: 'https://eu.i.posthog.com',
      disableGeoip: false,
      enableExceptionAutocapture: true,
      before_send: (event) =>
        withSimulatorOnException(event, this.connectedSimulator),
    });

    this.provider = new PostHogProvider(posthog);
  }

  capture(event: EventMessage): void {
    this.provider?.capture(event);
  }

  identify(message: IdentifyMessage): void {
    this.provider?.identify(message);
  }

  shutdown(shutdownTimeoutMs?: number): void {
    clearTimeout(this.radarPoleSideTimer);
    if (this.provider) {
      this.provider.shutdown(shutdownTimeoutMs);
    }
  }

  isInitialized(): boolean {
    return this.provider !== null;
  }

  private getOrCreateUserId(): string {
    if (this.userId) return this.userId;
    let userId = this.pendingUserId ?? readData<string>('userId');
    if (this.pendingUserId || !userId) {
      userId ||= crypto.randomUUID();
      // writeData updates its memory cache before writing to disk. Retain a
      // failed candidate only for a persistence retry, never for identify/logs.
      this.pendingUserId = userId;
      writeData('userId', userId);
      this.pendingUserId = undefined;
    }
    this.userId = userId;
    return userId;
  }

  /**
   * Forwards warnings and errors to PostHog, each with the simulator
   * connected as it was logged, so an error can be told apart by sim: none
   * between sessions, in demo mode or on a tape.
   */
  setupLogTransport(version: string): void {
    if (!this.provider || getAnalyticsOptOut()) return;

    // Resolve identity before installing the transport: storage diagnostics
    // must not recursively request identity. Reuse it later in init/identify.
    let userId: string;
    let scrub: (text: string) => string;
    try {
      userId = this.getOrCreateUserId();
      scrub = createLogPathScrubber(app.getPath('userData'), os.homedir());
    } catch {
      // Optional analytics must not break startup or log through itself.
      return;
    }

    const lastSent = new Map<string, number>();
    let forwarding = false;

    const transport = ((message: LogMessage) => {
      if (forwarding) return;
      forwarding = true;
      try {
        if (getAnalyticsOptOut()) return;
        const data = serializeLogArgs(message.data, scrub);
        const text = data
          .map((d) => (typeof d === 'string' ? d : JSON.stringify(d)))
          .join(' ')
          .slice(0, MAX_LOG_JSON_LENGTH);

        const key = `${message.level}:${text.slice(0, DEDUP_KEY_LENGTH)}`;
        const now = Date.now();
        const last = lastSent.get(key);
        if (last !== undefined && now - last < DEDUP_WINDOW_MS) return;
        lastSent.set(key, now);

        if (lastSent.size > DEDUP_MAX_ENTRIES) {
          for (const [k, t] of lastSent) {
            if (now - t >= DEDUP_WINDOW_MS) lastSent.delete(k);
          }
        }

        // Not the nicest way to do this, but avoids having to implement OTEL to get logging in posthog
        this.capture({
          distinctId: userId,
          event: 'log_message',
          properties: {
            version,
            level: message.level,
            message: text,
            data,
            simulator: this.connectedSimulator ?? null,
          },
        });
      } catch {
        // Serialization/provider failures must not affect local logging.
      } finally {
        forwarding = false;
      }
    }) as ElectronLog.Transport;
    transport.level = 'warn';
    transport.transforms = [];

    logger.transports.posthog = transport;
  }

  async init(version: string, dashboard: DashboardLayout): Promise<void> {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    // Electron's sizes are scaled by Windows display scaling; the resolution
    // is the physical one.
    const primaryResolution = physicalScreenSize(primaryDisplay);
    const cpus = os.cpus();
    const cpuName = cpus.length > 0 ? cpus[0].model : undefined;
    const userId = this.getOrCreateUserId();

    // Only the identify waits, for the simulators used, which are read from
    // a file. Nothing depends on it going first: app_started is anonymous,
    // and the reports below and log messages are tied to the installation
    // by distinctId, as startup log messages always were.
    this.startupIdentifyTask = this.identifyAtStartup(userId, {
      $os: os.platform(),
      $os_version: os.release(),
      os_arch: os.arch(),
      cpu_count: os.cpus().length,
      total_memory: os.totalmem(),
      $screen_width: primaryResolution.width,
      $screen_height: primaryResolution.height,
      screen_scale_factor: primaryDisplay.scaleFactor,
      number_of_screens: displays.length,
      cpu: cpuName,
      version,
      dashboard,
    }).catch(() => {
      logger.warn('[Analytics] Could not identify the installation');
    });

    this.capture({
      event: 'app_started',
    });

    // Startup must not wait for optional filesystem or network work. Keep the
    // caught task available to callers that explicitly need it to settle.
    this.pitLaneCalibrationTask ??= this.capturePitLaneCalibration(
      userId,
      version
    ).catch(() => {
      logger.warn('[Analytics] Could not publish pit lane calibration');
    });
    // After the pit lane report, so startup does one thing at a time.
    this.radarPoleSideTask ??= this.pitLaneCalibrationTask.then(() =>
      this.captureRadarPoleSides(userId, version)
    );
    this.reportRadarPoleSidesAfterFlips(userId, version);
  }

  /**
   * A flip is reported a minute after the last one rather than at the next
   * launch. If the app closes first, the launch still sends it, since the
   * acknowledged hash was never recorded.
   */
  private reportRadarPoleSidesAfterFlips(
    userId: string,
    version: string
  ): void {
    if (this.watchingRadarPoleSides) return;
    this.watchingRadarPoleSides = true;
    radarPoleSideOverrides.onChange(() => {
      clearTimeout(this.radarPoleSideTimer);
      this.radarPoleSideTimer = setTimeout(() => {
        this.radarPoleSideTask = (
          this.radarPoleSideTask ?? Promise.resolve()
        ).then(() => this.captureRadarPoleSides(userId, version));
      }, POLE_SIDE_REPORT_DELAY_MS);
      this.radarPoleSideTimer.unref?.();
    });
  }

  waitForRadarPoleSideUpload(): Promise<void> {
    return this.radarPoleSideTask ?? Promise.resolve();
  }

  waitForStartupIdentify(): Promise<void> {
    return this.startupIdentifyTask ?? Promise.resolve();
  }

  /**
   * Notes the simulator connected now, or none, for the next startup to
   * report which sims were used and for how long. Stored rather than sent, so
   * a sim that reconnects all evening costs nothing on the wire. Nothing is
   * noted while opted out.
   */
  setConnectedSimulator(simulator: ActiveSimulator | undefined): void {
    this.connectedSimulator = simulator;
    this.noteSimulatorInUse();
  }

  /** Notes whether the sim shows the track; only then is its time counted. */
  setWatchingTrack(watching: boolean): void {
    this.watchingTrack = watching;
    this.noteSimulatorInUse();
  }

  private noteSimulatorInUse(): void {
    if (!this.provider || getAnalyticsOptOut()) return;
    getSimulatorUsageStore().setConnected(
      this.watchingTrack ? this.connectedSimulator : undefined
    );
  }

  /**
   * Applies a change of the opt-out at once. Opting out stops the clock of
   * the use running now and deletes what was noted; opting back in starts
   * counting the sim in use now, from that moment.
   */
  async setOptOut(optOut: boolean): Promise<void> {
    if (optOut) {
      await getSimulatorUsageStore().clear();
      return;
    }
    this.noteSimulatorInUse();
  }

  /** The startup identify, once the simulators used are known. */
  private async identifyAtStartup(
    userId: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    const simulatorUsage = await this.takeSimulatorUsage();
    this.identify({
      distinctId: userId,
      disableGeoip: false,
      properties: {
        ...properties,
        ...simulatorUsage?.$set,
        ...(simulatorUsage && { $set_once: simulatorUsage.$set_once }),
      },
    });
  }

  /**
   * The simulators that connected since the last launch, as person
   * properties for the startup identify, taken off the list: not
   * acknowledged, so cleared as soon as it is queued. Undefined when there is
   * nothing to send, or when the list cannot be read yet, in which case it
   * stays for a later launch.
   */
  private async takeSimulatorUsage(): Promise<
    SimulatorUsageProperties | undefined
  > {
    if (!this.provider) return undefined;
    try {
      // Waits for the stored list to load. A connect noted meanwhile, such as
      // the sim already running as irdashies started, is merged into it.
      const store = getSimulatorUsageStore();
      if (!(await store.ready())) return undefined;
      const properties = buildSimulatorUsageProperties(
        store.takeForReport() ?? {}
      );
      // After the wait: the player may have opted out while the file loaded,
      // which deletes the list anyway.
      if (!properties || getAnalyticsOptOut()) return undefined;
      return properties;
    } catch {
      logger.warn('[Analytics] Could not read the simulators used');
      return undefined;
    }
  }

  /**
   * Reports the pole sides the player corrected with the radar key, once per
   * change, in the background. A revert to the table is reported too, but
   * nothing is sent for an installation that never corrected anything.
   */
  private async captureRadarPoleSides(
    userId: string,
    version: string
  ): Promise<void> {
    try {
      if (!this.provider || getAnalyticsOptOut()) return;
      // An unreadable file would look like every correction was reverted.
      if (!(await loadRadarPoleSideOverrides())) return;
      const report = buildRadarPoleSideReport(
        radarPoleSideOverrides.snapshot(),
        version
      );
      const stored = await readRadarPoleSideReportHash();
      const last =
        typeof stored === 'string' && /^[0-9a-f]{64}$/.test(stored)
          ? stored
          : undefined;
      if (report.properties.track_count === 0 && last === undefined) return;
      if (last === report.hash) return;
      if (
        Buffer.byteLength(JSON.stringify(report.properties), 'utf8') >
        MAX_POLE_SIDE_PROPERTIES_BYTES
      ) {
        logger.warn('[Analytics] Skipping oversized radar pole side report');
        return;
      }
      // The same report keeps its event id across retries, so a send whose
      // acknowledgement was lost is not counted twice while the app runs.
      if (this.poleSideEvent?.hash !== report.hash) {
        this.poleSideEvent = { hash: report.hash, uuid: crypto.randomUUID() };
      }
      // The player may have opted out while the file load was pending.
      if (getAnalyticsOptOut()) return;
      await this.provider.captureConfirmed({
        distinctId: userId,
        event: 'radar_pole_side',
        uuid: this.poleSideEvent.uuid,
        properties: report.properties,
      });
      // Recorded only after PostHog acknowledged it, so a failure retries.
      if (!getAnalyticsOptOut()) {
        await writeRadarPoleSideReportHash(report.hash);
      }
    } catch {
      logger.warn('[Analytics] Could not publish radar pole side report');
    }
  }

  waitForCalibrationUpload(): Promise<void> {
    return this.pitLaneCalibrationTask ?? Promise.resolve();
  }

  private async capturePitLaneCalibration(
    userId: string,
    version: string
  ): Promise<void> {
    if (
      !this.provider ||
      getAnalyticsOptOut() ||
      this.pitLaneCalibrationAttempted
    ) {
      return;
    }
    this.pitLaneCalibrationAttempted = true;
    try {
      const tracks = await readPitLaneCalibrationForAnalytics();
      if (!tracks || getAnalyticsOptOut()) return;
      // Tuples fix field order and numeric sorting makes JSON formatting,
      // object key order, ignored fields, and app version irrelevant.
      const canonical = Object.keys(tracks)
        .sort((a, b) => Number(a) - Number(b))
        .map((id) => [id, tracks[id].pitEntryPct, tracks[id].pitExitPct]);
      const dataHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(canonical))
        .digest('hex');
      const properties = {
        version,
        data_hash: dataHash,
        track_count: Object.keys(tracks).length,
        tracks,
      };
      // Leave headroom for SDK metadata below PostHog's 1 MB event limit.
      if (
        Buffer.byteLength(JSON.stringify(properties), 'utf8') >
        MAX_CALIBRATION_PROPERTIES_BYTES
      ) {
        logger.warn(
          '[Analytics] Skipping oversized pit lane calibration event'
        );
        return;
      }
      const checkpoint = await readPitLaneAnalyticsCheckpoint(userId);
      if (
        !checkpoint ||
        (checkpoint.lastAcknowledgedHash === dataHash && !checkpoint.pending) ||
        getAnalyticsOptOut()
      ) {
        return;
      }
      const pending =
        checkpoint.pending?.hash === dataHash
          ? checkpoint.pending
          : {
              hash: dataHash,
              distinctId: userId,
              uuid: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
            };
      if (
        pending !== checkpoint.pending &&
        !(await writePitLaneAnalyticsCheckpoint({ ...checkpoint, pending }))
      ) {
        return;
      }
      if (getAnalyticsOptOut()) return;
      await this.provider.captureConfirmed({
        distinctId: userId,
        event: 'pit_lane_calibration',
        uuid: pending.uuid,
        timestamp: new Date(pending.timestamp),
        properties,
      });
      if (getAnalyticsOptOut()) return;
      await writePitLaneAnalyticsCheckpoint({
        version: 1,
        distinctId: userId,
        lastAcknowledgedHash: dataHash,
      });
    } catch {
      logger.warn('[Analytics] Could not publish pit lane calibration');
    }
  }
}
