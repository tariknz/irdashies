import {
  channelRegistry,
  type ChannelBridge,
  type ChannelName,
  type ChannelPayloads,
  type IrSdkSourceBridge,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import {
  ChannelBus,
  type RendererTarget,
} from '../../../src/app/bridge/channelBus';
import { ProcessorHost } from '../../../src/app/processors/ProcessorHost';
import { createProcessorDefinitions } from '../../../src/app/processors/processorRegistry';
import { connectSessionLifecycleChannel } from '../../../src/app/bridge/sessionLifecycleChannel';
import type { SessionLifecycle } from '../../../src/app/sessionLifecycle/sessionLifecycle';

/**
 * In-browser stand-in for the app's main-process channel pipeline.
 *
 * The real app runs `ChannelBus` + `ProcessorHost` in Electron's main process
 * and reaches renderers over IPC. The site has no main process, so it runs the
 * same bus and the same processors directly in the page, fed by the mock SDK
 * source, and hands widgets a `ChannelBridge` that talks to them in-process.
 *
 * Using the real processors (rather than canned snapshots) is what keeps the
 * preview animated: gaps tick, input traces scroll, and the track map moves.
 */

interface Consumer {
  callback: (payload: never) => void;
  rate?: number;
}

interface LocalSubscription {
  consumers: Set<Consumer>;
  isSubscribed: boolean;
  subscribedRate?: number;
}

export interface PreviewChannelRuntime {
  bridge: ChannelBridge;
  dispose: () => void;
}

const noopMetrics = {
  markStart: () => undefined,
  markEnd: () => undefined,
};

/**
 * Wraps the mock SDK source so consumers cannot tear it down.
 *
 * `generateMockData().stop()` clears every registered callback and clears its
 * interval handles without nulling them, so its "start the interval only once"
 * guards then block any restart — one `stop()` kills telemetry permanently.
 * `RunningStateProvider` calls `stop()` on unmount, and StrictMode unmounts
 * once on mount, so the preview would lose telemetry before a visitor ever
 * saw it. The preview owns this source for the life of the page; nothing
 * mounted inside it gets to end that.
 */
export function shieldSourceFromStop(
  source: IrSdkSourceBridge
): IrSdkSourceBridge {
  return { ...source, stop: () => undefined };
}

export function createPreviewChannelRuntime(
  source: IrSdkSourceBridge
): PreviewChannelRuntime {
  const bus = new ChannelBus();
  const subscriptions = new Map<ChannelName, LocalSubscription>();
  let disposed = false;

  const target: RendererTarget = {
    id: 1,
    isDestroyed: () => disposed,
    // Always active. Gating this on `document.visibilityState` looks like a
    // free CPU saving but is a trap: a subscription created while the document
    // reports hidden counts as no visible demand, so ProcessorHost never
    // activates the processor and the preview stays permanently empty.
    // A document can report hidden while still painting (occluded tab,
    // automation, some embeds). The saving is redundant anyway — browsers
    // already throttle timers and pause rAF for genuinely backgrounded tabs.
    isVisible: () => true,
    send: (_ipcChannel, name, payload) => {
      const subscription = subscriptions.get(name as ChannelName);
      if (!subscription) return;
      // Mirror IPC's structured clone. Processors publish `this.latest` — one
      // object mutated in place — and the frontend's change detection
      // (`Object.is` in channel selections, useSyncExternalStore, useMemo
      // deps on snapshot arrays) relies on every delivery having a fresh
      // identity, which Electron's IPC provides for free. Without this clone
      // the first delivery is reference-equal to every later one, so widgets
      // mounted at page load freeze on the processor's empty initial
      // snapshot. One clone per delivery, shared by all consumers — exactly
      // what a renderer receives from a single IPC delivery.
      const cloned = structuredClone(payload);
      for (const consumer of subscription.consumers) {
        // Electron IPC isolates consumer exceptions from the main process;
        // in-process delivery must do the same or one throwing consumer
        // breaks unrelated widgets (and, via bus.publish's synchronous call
        // chain, gets misattributed as a ProcessorHost publication failure).
        try {
          consumer.callback(cloned as never);
        } catch (error) {
          logger.error(`[preview] channel consumer failed: ${name}`, error);
        }
      }
    },
  };

  // ProcessorHost only consumes the subscription half of the lifecycle. The
  // `_`-prefixed members are the main process's own ingest path and are never
  // called here, so they stay inert.
  const enterCallbacks = new Set<(event: { replay: boolean }) => void>();
  const lifecycle: SessionLifecycle = {
    onEnter: (cb) => {
      enterCallbacks.add(cb);
      return () => enterCallbacks.delete(cb);
    },
    onDriverJoined: () => () => undefined,
    onDriverLeft: () => () => undefined,
    onSessionNumChange: () => () => undefined,
    onDisconnect: () => () => undefined,
    _onEnter: () => undefined,
    _onTelemetry: () => undefined,
    _onSession: () => undefined,
    _onDisconnect: () => undefined,
  };

  const host = new ProcessorHost({
    bus,
    lifecycle,
    metrics: noopMetrics,
    logError: (message, error) => logger.error(message, error),
    definitions: createProcessorDefinitions({
      // The preview is throwaway state — nothing to persist between visits.
      referenceLapPersistence: { load: () => null, save: () => undefined },
    }),
  });

  // Publish lifecycle events onto the bus exactly as main.ts does, so a
  // widget subscribing to 'session.lifecycle' behaves the same here as in
  // the app. Wired before the enter announcement below so that first event
  // reaches the channel too.
  const disconnectLifecycleChannel = connectSessionLifecycleChannel(
    lifecycle,
    bus
  );

  // Announce a live (non-replay) session now that the host is listening, so
  // processors activate exactly as they do against a real SDK connection.
  for (const cb of enterCallbacks) cb({ replay: false });

  const stopSession = source.onSessionData((session) =>
    host.onSession(session)
  );
  const stopTelemetry = source.onTelemetry((telemetry) =>
    host.onFrame(telemetry)
  );

  const sync = (channel: ChannelName, subscription: LocalSubscription) => {
    const definition = channelRegistry[channel];
    const defaultRate =
      definition.kind === 'snapshot' ? definition.defaultRateHz : undefined;
    const rates = [...subscription.consumers]
      .map((consumer) => consumer.rate ?? defaultRate)
      .filter((rate): rate is number => rate !== undefined);
    const requestedRate = rates.length > 0 ? Math.max(...rates) : undefined;
    if (
      subscription.isSubscribed &&
      subscription.subscribedRate === requestedRate
    ) {
      return;
    }
    // Record the subscription only after the bus accepts it. bus.subscribe
    // validates synchronously (rate > maxRateHz, any rate on an event
    // channel) and a throw after flipping these flags would make the
    // early-return above skip every future attempt — one bad rate would
    // permanently poison the channel for all widgets.
    bus.subscribe(target, channel, requestedRate);
    subscription.isSubscribed = true;
    subscription.subscribedRate = requestedRate;
  };

  const bridge: ChannelBridge = {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void,
      requestedRateHz?: number
    ) => {
      let subscription = subscriptions.get(channel);
      if (!subscription) {
        subscription = { consumers: new Set(), isSubscribed: false };
        subscriptions.set(channel, subscription);
      }
      const consumer: Consumer = {
        callback: callback as (payload: never) => void,
        rate: requestedRateHz,
      };
      subscription.consumers.add(consumer);
      try {
        sync(channel, subscription);
      } catch (error) {
        // Match the Electron renderer bridge, where a rejected subscribe
        // never throws into the widget (fire-and-forget invoke): drop this
        // consumer, log, and leave the channel state untouched so other
        // widgets and future subscribes are unaffected.
        subscription.consumers.delete(consumer);
        if (subscription.consumers.size === 0) subscriptions.delete(channel);
        logger.error(`[preview] channel subscribe failed: ${channel}`, error);
        return () => undefined;
      }

      let active = true;
      return () => {
        if (!active) return;
        active = false;
        subscription?.consumers.delete(consumer);
        if (!subscription || subscription.consumers.size === 0) {
          subscriptions.delete(channel);
          bus.unsubscribe(target.id, channel);
          return;
        }
        sync(channel, subscription);
      };
    },
  };

  return {
    bridge,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disconnectLifecycleChannel();
      stopTelemetry?.();
      stopSession?.();
      host.dispose();
      bus.dispose();
      subscriptions.clear();
    },
  };
}
