import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useDashboard } from '@irdashies/context';
import type {
  ChannelName,
  DashboardLayout,
  WidgetPreviewHold,
  WidgetPreviewMessage,
} from '@irdashies/types';
import { parsePreviewRequest } from '@irdashies/domain/widgetPreview/protocol';
import { resolvePreviewWidget } from '@irdashies/domain/widgetPreview/presentation';
import logger from '@irdashies/utils/logger';

const NO_HOLD: WidgetPreviewHold = { windowHidden: false, driving: false };

/**
 * Owns the disposable frame and connection, including every failure path.
 *
 * Pausing stops the demo but keeps the frame, which goes on showing its last
 * picture. It happens with the Pause button, while the page or the window is
 * hidden (minimised or in the tray), and when the player gets in the car.
 * Play always works, in the car too: the preview then runs until the player
 * gets out, and pauses again the next time they get in. Resuming reconnects
 * the same frame: a new demo session, with the channels the frame asked for.
 */
export function useWidgetPreviewSession(
  widgetId: string,
  dashboard: DashboardLayout | null | undefined
) {
  const { bridge: dashboardBridge } = useDashboard();
  const bridge = window.widgetPreviewBridge;
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(
    () => document.visibilityState !== 'hidden'
  );
  const [hold, setHold] = useState(NO_HOLD);
  const [playInCar, setPlayInCar] = useState(false);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const paused =
    userPaused || !visible || hold.windowHidden || (hold.driving && !playInCar);
  // Not tied to pausing: the frame stays, showing its last picture.
  const renderFrame = !!bridge && !error;
  const live = renderFrame && !paused;
  const latest = useRef({ widgetId, dashboard, dashboardBridge });
  useLayoutEffect(() => {
    latest.current = { widgetId, dashboard, dashboardBridge };
  }, [widgetId, dashboard, dashboardBridge]);
  const ref = useCallback((element: HTMLIFrameElement | null) => {
    setLoaded(false);
    setReady(false);
    setFrame(element);
  }, []);

  useEffect(() => {
    const onVisibility = () =>
      setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(
    () =>
      bridge?.onHold((next) => {
        setHold(next);
        if (!next.driving) setPlayInCar(false);
      }),
    [bridge]
  );

  // Declared before the frame's effect, so that effect starts from the
  // current value; afterwards, changes reach the running frame through this.
  const liveRef = useRef(live);
  const setFrameLive = useRef<((live: boolean) => void) | null>(null);
  useEffect(() => {
    liveRef.current = live;
    setFrameLive.current?.(live);
  }, [live]);

  useEffect(() => {
    if (!renderFrame || !frame || !bridge) return;
    let disposed = false;
    let isLive = liveRef.current;
    /** The frame's document has announced itself and waits for a session. */
    let frameReady = false;
    /** The frame has had a session, so it has a picture and a config. */
    let initialized = false;
    let connecting = false;
    let connected = false;
    /** Moves on with every connect and stop, so a late answer is dropped. */
    let attempt = 0;
    /** A demo session has been started since going live and not stopped. */
    let sessionOpen = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let telemetryTimer: ReturnType<typeof setInterval> | undefined;
    /**
     * The channels the frame's widgets asked for, kept while paused. The
     * widgets stay subscribed inside the frame and do not ask again, so a
     * resumed session reopens these itself.
     */
    const requested = new Map<ChannelName, number | undefined>();
    const subscriptions = new Map<
      ChannelName,
      { unsubscribe(): void; rate?: number }
    >();
    const send = (message: WidgetPreviewMessage) => {
      if (!disposed) frame.contentWindow?.postMessage(message, '*');
    };
    const closeSubscriptions = () => {
      if (telemetryTimer) clearInterval(telemetryTimer);
      telemetryTimer = undefined;
      for (const subscription of subscriptions.values())
        subscription.unsubscribe();
      subscriptions.clear();
    };
    const open = (channel: ChannelName, rate: number | undefined) => {
      const previous = subscriptions.get(channel);
      if (previous && previous.rate === rate) return;
      const unsubscribe = bridge.subscribe(
        channel,
        (payload) =>
          send({
            type: 'preview:snapshot',
            channel,
            payload,
          }),
        rate
      );
      previous?.unsubscribe();
      subscriptions.set(channel, { unsubscribe, rate });
    };
    const stopSession = () => {
      attempt++;
      connecting = false;
      connected = false;
      clearTimeout(timeout);
      closeSubscriptions();
      if (!sessionOpen) return;
      sessionOpen = false;
      void bridge
        .disconnect()
        .catch((reason: unknown) =>
          logger.warn('Could not stop widget preview', reason)
        );
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      if (setFrameLive.current === setLive) setFrameLive.current = null;
      stopSession();
      window.removeEventListener('message', receive);
    };
    const fail = (message: string) => {
      if (disposed) return;
      setError(message);
      dispose();
    };
    const startTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(
        () => fail('The preview could not load. Try again.'),
        15000
      );
    };
    const connect = () => {
      if (connecting) return;
      const current = ++attempt;
      connecting = true;
      connected = false;
      closeSubscriptions();
      startTimeout();
      void bridge
        .connect()
        .then((session) => {
          if (disposed || current !== attempt || !latest.current.dashboard)
            return;
          connected = true;
          connecting = false;
          initialized = true;
          clearTimeout(timeout);
          const config = {
            widgetId: latest.current.widgetId,
            dashboard: latest.current.dashboard,
          };
          send({ type: 'preview:init', session, config });
          const selected = resolvePreviewWidget(
            config.dashboard,
            config.widgetId
          );
          if (selected?.type === 'telemetryinspector') {
            const poll = () => {
              void bridge
                .getTelemetry()
                .then((telemetry) => {
                  if (telemetry) send({ type: 'preview:telemetry', telemetry });
                })
                .catch((reason: unknown) =>
                  logger.warn('Could not read demo inspector telemetry', reason)
                );
            };
            poll();
            telemetryTimer = setInterval(poll, 1000);
          }
          for (const [channel, rate] of requested) open(channel, rate);
          setReady(true);
        })
        .catch((reason: unknown) => {
          if (disposed || current !== attempt) return;
          logger.error('Could not start widget preview', reason);
          fail('The demo could not start. Try again.');
        });
    };
    function setLive(next: boolean) {
      if (disposed || next === isLive) return;
      isLive = next;
      if (!next) {
        stopSession();
        return;
      }
      sessionOpen = true;
      if (frameReady) connect();
      // Still waiting for the document to announce itself.
      else startTimeout();
    }
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.contentWindow) return;
      const request = parsePreviewRequest(event.data);
      if (!request) return;
      if (request.type === 'preview:ready') {
        if (connecting) return;
        // A newly loaded document: what the previous one asked for is gone.
        frameReady = true;
        initialized = false;
        requested.clear();
        setReady(false);
        if (isLive) connect();
        else {
          clearTimeout(timeout);
          closeSubscriptions();
        }
      } else if (request.type === 'preview:asset') {
        if (!initialized) return;
        const config =
          latest.current.dashboard &&
          resolvePreviewWidget(
            latest.current.dashboard,
            latest.current.widgetId
          )?.config;
        const playerIcon = config?.playerIcon as
          { fileName?: unknown } | undefined;
        const expected =
          request.kind === 'garageCover'
            ? config?.imageFilename
            : playerIcon?.fileName;
        const assets = latest.current.dashboardBridge;
        const read =
          request.kind === 'garageCover'
            ? assets?.getGarageCoverImageAsDataUrl
            : assets?.getPlayerIconImageAsDataUrl;
        void (
          expected === request.filename && read
            ? read(request.filename)
            : Promise.resolve(null)
        )
          .catch(() => null)
          .then((dataUrl) =>
            send({
              type: 'preview:asset',
              requestId: request.requestId,
              dataUrl,
            })
          );
      } else if (request.type === 'preview:unsubscribe') {
        requested.delete(request.channel);
        subscriptions.get(request.channel)?.unsubscribe();
        subscriptions.delete(request.channel);
      } else {
        requested.set(request.channel, request.rate);
        if (connected) open(request.channel, request.rate);
      }
    };
    setFrameLive.current = setLive;
    window.addEventListener('message', receive);
    if (isLive) {
      sessionOpen = true;
      startTimeout();
    }
    return dispose;
  }, [renderFrame, frame, bridge]);

  useEffect(() => {
    if (!ready || !dashboard) return;
    const message: WidgetPreviewMessage = {
      type: 'preview:config',
      config: { widgetId, dashboard },
    };
    frame?.contentWindow?.postMessage(message, '*');
  }, [dashboard, widgetId, ready, frame]);

  return {
    ref,
    loaded,
    loading: live && (!ready || !loaded),
    renderFrame,
    available: !!bridge,
    playing: !paused,
    error,
    onLoad: () => setLoaded(true),
    togglePlaying: () => {
      if (!paused) {
        setUserPaused(true);
        return;
      }
      setUserPaused(false);
      if (hold.driving) setPlayInCar(true);
    },
    retry: () => setError(''),
  };
}
