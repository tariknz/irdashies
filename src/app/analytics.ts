import { PostHog } from 'posthog-node';
import type { EventMessage, IdentifyMessage } from 'posthog-node';
import { screen } from 'electron';
import os from 'node:os';
import crypto from 'node:crypto';
import type { DashboardLayout } from '@irdashies/types';
import { readData, writeData } from './storage/storage';
import { getAnalyticsOptOut } from './storage/analytics';
import logger from './logger';
import type ElectronLog from 'electron-log';
import type { LogMessage } from 'electron-log';

declare const POSTHOG_KEY: string;

export interface AnalyticsProvider {
  capture(event: EventMessage): void;
  identify(message: IdentifyMessage): void;
  shutdown(shutdownTimeoutMs?: number): void;
}

class PostHogProvider implements AnalyticsProvider {
  constructor(private posthog: PostHog) {}

  capture(event: EventMessage): void {
    this.posthog.capture(event);
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
    if (this.provider) {
      this.provider.shutdown(shutdownTimeoutMs);
    }
  }

  isInitialized(): boolean {
    return this.provider !== null;
  }

  private getOrCreateUserId(): string {
    let userId = readData<string>('userId');
    if (!userId) {
      userId = crypto.randomUUID();
      writeData('userId', userId);
    }
    return userId;
  }

  setupLogTransport(): void {
    if (!this.provider) return;

    const transport = ((message: LogMessage) => {
      const text = message.data
        .map((d: unknown) => (typeof d === 'string' ? d : JSON.stringify(d)))
        .join(' ');

      // Not the nicest way to do this, but avoids having to implement OTEL to get logging in posthog
      this.capture({
        event: 'log_message',
        properties: {
          level: message.level,
          message: text,
        },
      });
    }) as ElectronLog.Transport;
    transport.level = 'warn';
    transport.transforms = [];

    logger.transports.posthog = transport;
  }

  async init(version: string, dashboard: DashboardLayout): Promise<void> {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const cpus = os.cpus();
    const cpuName = cpus.length > 0 ? cpus[0].model : undefined;
    const userId = this.getOrCreateUserId();

    this.identify({
      distinctId: userId,
      disableGeoip: false,
      properties: {
        $os: os.platform(),
        $os_version: os.release(),
        os_arch: os.arch(),
        cpu_count: os.cpus().length,
        total_memory: os.totalmem(),
        $screen_width: primaryDisplay.size.width,
        $screen_height: primaryDisplay.size.height,
        number_of_screens: displays.length,
        cpu: cpuName,
        version,
        dashboard,
      },
    });

    this.capture({
      event: 'app_started',
    });
  }
}
