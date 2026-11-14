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
  WidgetPreviewMessage,
  WidgetPreviewStatus,
} from '@irdashies/types';
import { parsePreviewRequest } from '@irdashies/domain/widgetPreview/protocol';
import { resolvePreviewWidget } from '@irdashies/domain/widgetPreview/presentation';
import logger from '@irdashies/utils/logger';

/** Until main reports, nothing holds the preview. */
const UNHELD: WidgetPreviewStatus = {
  windowHidden: false,
  driving: false,
  playInCar: false,
  running: true,
};

/**
 * Owns the disposable frame and connection, including every failure path.
 *
 * Pausing never touches the connection: main pauses the window's demo in
 * place and the frame holds its animation loops, so it goes on showing its
 * last picture and carries on from there. The page reports its own reasons
 * (the Pause button, and being hidden); main adds the window being hidden
 * and the player being in the car, where Play still starts the preview
 * until they get out.
 */
export function useWidgetPreviewSession(
  widgetId: string,
  dashboard: DashboardLayout | null | undefined
) {
  const { bridge: dashboardBridge } = useDashboard();
  const bridge = window.widgetPreviewBridge;
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(
    () => document.visibilityState === 'hidden'
  );
  const [status, setStatus] = useState(UNHELD);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const renderFrame = !!bridge && !error;
  const pagePaused = userPaused || documentHidden;
  const heldInCar = status.driving && !status.playInCar;
  const playing = !pagePaused && !status.windowHidden && !heldInCar;
  const latest = useRef({
    widgetId,
    dashboard,
    dashboardBridge,
    running: status.running,
  });
  useLayoutEffect(() => {
    latest.current = {
      widgetId,
      dashboard,
      dashboardBridge,
      running: status.running,
    };
  }, [widgetId, dashboard, dashboardBridge, status.running]);
  const ref = useCallback((element: HTMLIFrameElement | null) => {
    setLoaded(false);
    setReady(false);
    setFrame(element);
  }, []);

  useEffect(() => {
    const onVisibility = () =>
      setDocumentHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => bridge?.onStatus(setStatus), [bridge]);

  useEffect(() => {
    void bridge
      ?.setPaused(pagePaused)
      .catch((reason: unknown) =>
        logger.warn('Could not pause widget preview', reason)
      );
  }, [bridge, pagePaused]);

  /** Tells the connected frame whether the demo is advancing. */
  const tellFrame = useRef<((running: boolean) => void) | null>(null);
  useEffect(() => {
    tellFrame.current?.(status.running);
  }, [status.running]);

  useEffect(() => {
    if (!renderFrame || !frame || !bridge) return;
    let disposed = false;
    let connecting = false;
    let connected = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let telemetryTimer: ReturnType<typeof setInterval> | undefined;
    const subscriptions = new Map<
      ChannelName,
      { unsubscribe(): void; rate?: number }
    >();
    const send = (message: WidgetPreviewMessage) => {
      if (!disposed) frame.contentWindow?.postMessage(message, '*');
    };
    /** Only a frame that has had its session runs animations to hold. */
    const tell = (running: boolean) => {
      if (connected)
        send({ type: running ? 'preview:resume' : 'preview:pause' });
    };
    const stopSubscriptions = () => {
      if (telemetryTimer) clearInterval(telemetryTimer);
      telemetryTimer = undefined;
      for (const subscription of subscriptions.values())
        subscription.unsubscribe();
      subscriptions.clear();
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      if (tellFrame.current === tell) tellFrame.current = null;
      clearTimeout(timeout);
      stopSubscriptions();
      window.removeEventListener('message', receive);
      void bridge
        .disconnect()
        .catch((reason: unknown) =>
          logger.warn('Could not stop widget preview', reason)
        );
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
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.contentWindow) return;
      const request = parsePreviewRequest(event.data);
      if (!request) return;
      if (request.type === 'preview:ready') {
        if (connecting) return;
        // A newly loaded document: what the previous one asked for is gone.
        connecting = true;
        connected = false;
        setReady(false);
        stopSubscriptions();
        startTimeout();
        void bridge
          .connect()
          .then((session) => {
            if (disposed || !latest.current.dashboard) return;
            connected = true;
            connecting = false;
            clearTimeout(timeout);
            const config = {
              widgetId: latest.current.widgetId,
              dashboard: latest.current.dashboard,
            };
            send({ type: 'preview:init', session, config });
            tell(latest.current.running);
            const selected = resolvePreviewWidget(
              config.dashboard,
              config.widgetId
            );
            if (selected?.type === 'telemetryinspector') {
              // Until the frame has a picture, also while paused: main keeps
              // the paused demo's last frame, which the frame then holds.
              let pictured = false;
              const poll = () => {
                if (pictured && !latest.current.running) return;
                void bridge
                  .getTelemetry()
                  .then((telemetry) => {
                    if (!telemetry) return;
                    pictured = true;
                    send({ type: 'preview:telemetry', telemetry });
                  })
                  .catch((reason: unknown) =>
                    logger.warn(
                      'Could not read demo inspector telemetry',
                      reason
                    )
                  );
              };
              poll();
              telemetryTimer = setInterval(poll, 1000);
            }
            setReady(true);
          })
          .catch((reason: unknown) => {
            if (disposed) return;
            logger.error('Could not start widget preview', reason);
            fail('The demo could not start. Try again.');
          });
      } else if (request.type === 'preview:asset') {
        if (!connected) return;
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
      } else if (connected) {
        const previous = subscriptions.get(request.channel);
        if (request.type === 'preview:unsubscribe') {
          previous?.unsubscribe();
          subscriptions.delete(request.channel);
        } else if (!previous || previous.rate !== request.rate) {
          const unsubscribe = bridge.subscribe(
            request.channel,
            (payload) =>
              send({
                type: 'preview:snapshot',
                channel: request.channel,
                payload,
              }),
            request.rate
          );
          previous?.unsubscribe();
          subscriptions.set(request.channel, {
            unsubscribe,
            rate: request.rate,
          });
        }
      }
    };
    tellFrame.current = tell;
    startTimeout();
    window.addEventListener('message', receive);
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
    loading: renderFrame && (!ready || !loaded),
    renderFrame,
    playing,
    error,
    onLoad: () => setLoaded(true),
    togglePlaying: () => {
      if (playing) {
        setUserPaused(true);
        return;
      }
      setUserPaused(false);
      // Asked whatever the last status said: main ignores it unless the
      // player is in the car by its latest state, so a status that has not
      // caught up neither swallows this press nor leaves the flag set for
      // their next drive.
      if (!status.playInCar)
        void bridge
          ?.playInCar()
          .catch((reason: unknown) =>
            logger.warn('Could not play widget preview in the car', reason)
          );
    },
    retry: () => setError(''),
  };
}
