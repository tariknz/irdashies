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

/** Owns the disposable frame and connection, including every failure path. */
export function useWidgetPreviewSession(
  widgetId: string,
  dashboard: DashboardLayout | null | undefined
) {
  const { bridge: dashboardBridge } = useDashboard();
  const bridge = window.widgetPreviewBridge;
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(
    () => document.visibilityState !== 'hidden'
  );
  // Held by main while the window is minimised or in the tray, and while the
  // player is in the car. Separate from `playing`, so a preview the user
  // paused stays paused when the hold lifts, and one left playing resumes.
  const [hold, setHold] = useState(NO_HOLD);
  const held = hold.windowHidden || hold.driving;
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const renderFrame = playing && visible && !held && !!bridge && !error;
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

  useEffect(() => bridge?.onHold(setHold), [bridge]);

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
    const stopSubscriptions = () => {
      if (telemetryTimer) clearInterval(telemetryTimer);
      for (const subscription of subscriptions.values())
        subscription.unsubscribe();
      subscriptions.clear();
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
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
            const selected = resolvePreviewWidget(
              config.dashboard,
              config.widgetId
            );
            if (selected?.type === 'telemetryinspector') {
              const poll = () => {
                void bridge
                  .getTelemetry()
                  .then((telemetry) => {
                    if (telemetry)
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
    available: !!bridge,
    playing,
    /** Paused for the player being in the car, not by the Pause button. */
    heldWhileDriving: hold.driving && playing && !error,
    error,
    onLoad: () => setLoaded(true),
    togglePlaying: () => setPlaying((previous) => !previous),
    retry: () => setError(''),
  };
}
