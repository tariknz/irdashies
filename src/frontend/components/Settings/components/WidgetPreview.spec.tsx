import { act, fireEvent, render, screen } from '@testing-library/react';
import { startTransition, Suspense, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultDashboard,
  type DashboardLayout,
  type Session,
  type Telemetry,
  type WidgetPreviewMessage,
  type WidgetPreviewStatus,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import { WidgetPreview } from './WidgetPreview';
import { useWidgetPreviewSession } from './useWidgetPreviewSession';

const save = vi.fn();
const toggleDemo = vi.fn();
/** A dashboard to preview instead of the default one. */
let dashboard: DashboardLayout | undefined;
vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: dashboard ?? defaultDashboard,
    onDashboardUpdated: save,
    toggleDemoMode: toggleDemo,
  }),
  useElementSize: () => ({ width: 800, height: 240 }),
}));
vi.mock('@irdashies/utils/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const session = { DriverInfo: { Drivers: [] } } as unknown as Session;
const connect = vi.fn(async () => session);
const disconnect = vi.fn(async () => undefined);
const stop = vi.fn();
const subscribe = vi.fn(() => stop);
const getTelemetry = vi.fn(async (): Promise<Telemetry | null> => null);
const setPaused = vi.fn(async (paused: boolean): Promise<void> => {
  void paused;
});
const playInCar = vi.fn(async (): Promise<void> => undefined);
/** Pushes a status the way main does; set while a preview is listening. */
let sendStatus: ((status: WidgetPreviewStatus) => void) | undefined;
const onStatus = vi.fn((callback: (status: WidgetPreviewStatus) => void) => {
  sendStatus = callback;
  return () => {
    sendStatus = undefined;
  };
});
const status = (value: Partial<WidgetPreviewStatus>) =>
  act(() =>
    sendStatus?.({
      windowHidden: false,
      driving: false,
      playInCar: false,
      running: true,
      ...value,
    })
  );
const requireWindow = (frame: HTMLIFrameElement) => {
  if (!frame.contentWindow) throw new Error('Expected a preview frame window');
  return frame.contentWindow;
};
/** Posts a request as the frame's document would. */
const request = (frame: HTMLIFrameElement, data: unknown) =>
  window.dispatchEvent(
    new MessageEvent('message', { data, source: frame.contentWindow })
  );
/** Records what the host posts to the frame, by message type. */
const watchFrame = (frame: HTMLIFrameElement) => {
  const post = vi.spyOn(requireWindow(frame), 'postMessage');
  return (...types: WidgetPreviewMessage['type'][]) =>
    post.mock.calls
      .map(([message]) => (message as WidgetPreviewMessage).type)
      .filter((type) => types.includes(type));
};
/** The frame, once its document has announced itself and got a session. */
const connectedFrame = async (title: string) => {
  const frame = screen.getByTitle(title) as HTMLIFrameElement;
  await act(async () => request(frame, { type: 'preview:ready' }));
  expect(connect).toHaveBeenCalledOnce();
  return frame;
};
const playButton = () => screen.getByRole('button', { name: 'Play preview' });
const pauseButton = () => screen.getByRole('button', { name: 'Pause preview' });
const setDocumentVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  fireEvent(document, new Event('visibilitychange'));
};

beforeEach(() => {
  vi.clearAllMocks();
  connect.mockResolvedValue(session);
  setPaused.mockResolvedValue(undefined);
  playInCar.mockResolvedValue(undefined);
  getTelemetry.mockResolvedValue(null);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  );
  window.widgetPreviewBridge = {
    connect,
    disconnect,
    subscribe,
    getTelemetry,
    onStatus,
    setPaused,
    playInCar,
  };
});
afterEach(() => {
  dashboard = undefined;
  delete window.widgetPreviewBridge;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('settings widget preview', () => {
  it('initializes from committed configuration when a newer render suspends', async () => {
    let resolveSession!: (value: Session) => void;
    connect.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSession = resolve;
      })
    );
    const pending = new Promise<never>(() => undefined);
    function Preview({ suspended }: { suspended: boolean }) {
      const preview = useWidgetPreviewSession(
        'input',
        suspended ? { ...defaultDashboard, widgets: [] } : defaultDashboard
      );
      if (suspended) throw pending;
      return <iframe title="Committed preview" ref={preview.ref} />;
    }
    function Host() {
      const [suspended, setSuspended] = useState(false);
      return (
        <>
          <button onClick={() => startTransition(() => setSuspended(true))}>
            Suspend update
          </button>
          <Suspense fallback={<p>Suspended</p>}>
            <Preview suspended={suspended} />
          </Suspense>
        </>
      );
    }
    const { unmount } = render(<Host />);
    const frame = screen.getByTitle('Committed preview') as HTMLIFrameElement;
    const contentWindow = frame.contentWindow;
    if (!contentWindow) throw new Error('Expected a preview frame window');
    const post = vi.spyOn(contentWindow, 'postMessage');
    act(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'preview:ready' },
          source: frame.contentWindow,
        })
      )
    );
    await act(async () => fireEvent.click(screen.getByText('Suspend update')));
    expect(screen.queryByText('Suspended')).toBeNull();
    await act(async () => resolveSession(session));
    const init = post.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'preview:init');
    expect(
      init?.config.dashboard === defaultDashboard,
      'preview:init must use the committed dashboard'
    ).toBe(true);
    unmount();
  });

  it('keeps the initial iframe paint hidden until its document styles have loaded and its demo runs', async () => {
    render(<WidgetPreview widgetId="input" />);
    const frame = screen.getByTitle('Input Traces demo') as HTMLIFrameElement;
    expect(frame).toHaveClass('invisible');
    fireEvent.load(frame);
    // Loaded, but nothing to show before it has a running demo.
    expect(frame).toHaveClass('invisible');
    await connectedFrame('Input Traces demo');
    expect(frame).not.toHaveClass('invisible');
    // Pausing keeps the loaded frame, so it never has to be hidden again.
    fireEvent.click(pauseButton());
    fireEvent.click(playButton());
    expect(screen.getByTitle('Input Traces demo')).toBe(frame);
    expect(frame).not.toHaveClass('invisible');
  });

  it('fits the original frame without changing saved layout or global demo mode', () => {
    render(<WidgetPreview widgetId="broadcastticker" />);
    const frame = screen.getByTitle('Broadcast Ticker demo');
    expect(frame).toHaveStyle({ width: '1920px', height: '72px' });
    expect(frame.style.transform).toBe('scale(0.4)');
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(frame).toHaveStyle({ transform: 'scale(1)' });
    expect(save).not.toHaveBeenCalled();
    expect(toggleDemo).not.toHaveBeenCalled();
  });

  it('shows the saved size in whole pixels, also after switching widgets and back', () => {
    // Edit mode saves layouts from pointer deltas, which on a scaled display
    // are fractions of a CSS pixel.
    dashboard = {
      ...defaultDashboard,
      widgets: defaultDashboard.widgets.map((widget) =>
        widget.id === 'input'
          ? {
              ...widget,
              layout: {
                ...widget.layout,
                width: 396.40000000000003,
                height: 119.99999999999999,
              },
            }
          : widget
      ),
    };
    const sizeLabel = () => screen.getByText(/ × /).textContent;
    const { rerender } = render(<WidgetPreview widgetId="input" />);
    expect(sizeLabel()).toMatch(/^396 × 120 · \d+%$/);

    rerender(<WidgetPreview widgetId="broadcastticker" />);
    expect(sizeLabel()).toMatch(/^1920 × 72 · /);
    rerender(<WidgetPreview widgetId="input" />);
    expect(sizeLabel()).toMatch(/^396 × 120 · \d+%$/);
    expect(screen.getByTitle('Input Traces demo')).toHaveStyle({
      width: '396px',
      height: '120px',
    });
    // The shown size is the saved one: nothing to reset.
    expect(
      screen.getByRole('button', { name: 'Reset preview size' })
    ).toBeDisabled();
  });

  it('pans with the keyboard and recenters without changing the widget or demo', () => {
    render(<WidgetPreview widgetId="broadcastticker" />);
    const frame = screen.getByTitle('Broadcast Ticker demo');
    const content = frame.parentElement;
    const canvas = screen.getByRole('region', {
      name: 'Broadcast Ticker preview canvas',
    });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'ArrowUp', shiftKey: true });
    expect(content).toHaveStyle({ transform: 'translate(32px, -128px)' });
    fireEvent.keyDown(canvas, { key: 'Home' });
    expect(content).toHaveStyle({ transform: 'translate(0px, 0px)' });
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' });
    expect(content).toHaveStyle({ transform: 'translate(-32px, 0px)' });
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(content).toHaveStyle({ transform: 'translate(0px, 0px)' });
    expect(screen.getByTitle('Broadcast Ticker demo')).toBe(frame);
    expect(disconnect).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(toggleDemo).not.toHaveBeenCalled();
  });

  it('resizes only the demo frame, including at a fitted scale, and resets its dimensions', () => {
    render(<WidgetPreview widgetId="broadcastticker" />);
    const frame = screen.getByTitle('Broadcast Ticker demo');
    const handle = screen.getByRole('button', {
      name: 'Resize widget bottom right',
    });
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true });
    expect(frame).toHaveStyle({
      width: '1930px',
      height: '82px',
      transform: 'scale(0.4)',
    });
    expect(frame.parentElement).toHaveStyle({
      transform: 'translate(2px, 2px)',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset preview size' }));
    expect(frame).toHaveStyle({
      width: '1920px',
      height: '72px',
      transform: 'scale(0.4)',
    });
    expect(save).not.toHaveBeenCalled();
    expect(toggleDemo).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('accepts channel requests only from its frame and preserves unchanged subscriptions', async () => {
    const { unmount } = render(<WidgetPreview widgetId="input" />);
    const frame = screen.getByTitle('Input Traces demo') as HTMLIFrameElement;
    const request = (
      data: unknown,
      source: MessageEventSource | null = frame.contentWindow
    ) => window.dispatchEvent(new MessageEvent('message', { data, source }));
    await act(async () => {
      request({ type: 'preview:ready' }, window);
    });
    expect(connect).not.toHaveBeenCalled();
    act(() => {
      request({ type: 'preview:subscribe', channel: 'track-state.snapshot' });
    });
    // Nothing to deliver to before the frame has its session.
    expect(subscribe).not.toHaveBeenCalled();
    await act(async () => {
      request({ type: 'preview:ready' });
    });
    expect(connect).toHaveBeenCalledOnce();
    act(() => {
      request({
        type: 'preview:subscribe',
        channel: 'driver-controls.snapshot',
        rate: 25,
      });
      request({
        type: 'preview:subscribe',
        channel: 'driver-controls.snapshot',
        rate: 25,
      });
      request(
        { type: 'preview:subscribe', channel: 'track-state.snapshot' },
        window
      );
      request({ type: 'preview:subscribe', channel: '__proto__' });
    });
    expect(subscribe).toHaveBeenCalledOnce();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(sendStatus).toBeUndefined();
  });

  it('pauses and plays without touching the frame or its connection', async () => {
    render(<WidgetPreview widgetId="broadcastticker" />);
    const frame = await connectedFrame('Broadcast Ticker demo');
    const posted = watchFrame(frame);
    request(frame, {
      type: 'preview:subscribe',
      channel: 'driver-controls.snapshot',
      rate: 25,
    });
    expect(subscribe).toHaveBeenCalledOnce();

    fireEvent.click(pauseButton());
    expect(setPaused).toHaveBeenLastCalledWith(true);
    expect(screen.getByTitle('Broadcast Ticker demo')).toBe(frame);
    expect(stop).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
    expect(screen.queryByText(/paused/i)).toBeNull();
    // Still connected: a widget asking for a channel gets it, and settings
    // changes reach the paused frame.
    request(frame, {
      type: 'preview:subscribe',
      channel: 'track-state.snapshot',
    });
    expect(subscribe).toHaveBeenCalledTimes(2);
    const configs = posted('preview:config').length;
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Resize widget bottom right' }),
      { key: 'ArrowRight', shiftKey: true }
    );
    expect(posted('preview:config')).toHaveLength(configs + 1);

    fireEvent.click(playButton());
    expect(setPaused).toHaveBeenLastCalledWith(false);
    expect(screen.getByTitle('Broadcast Ticker demo')).toBe(frame);
    expect(connect).toHaveBeenCalledOnce();
    expect(posted('preview:init')).toHaveLength(0);
    // Asked anyway; main ignores it outside the car.
    expect(playInCar).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("reports only the page's own reasons to pause", async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    render(<WidgetPreview widgetId="input" />);
    // A new widget page starts playing.
    expect(setPaused.mock.calls).toEqual([[false]]);
    await connectedFrame('Input Traces demo');

    status({ windowHidden: true, running: false });
    status({ driving: true, running: false });
    status({ running: true });
    expect(setPaused).toHaveBeenCalledOnce();

    setDocumentVisibility('hidden');
    expect(setPaused).toHaveBeenLastCalledWith(true);
    expect(playButton()).toBeVisible();
    setDocumentVisibility('visible');
    expect(setPaused).toHaveBeenLastCalledWith(false);
    expect(pauseButton()).toBeVisible();

    fireEvent.click(pauseButton());
    setDocumentVisibility('hidden');
    setDocumentVisibility('visible');
    // Still paused by the button: nothing new to report.
    expect(setPaused.mock.calls).toEqual([[false], [true], [false], [true]]);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('logs a failed pause report instead of throwing', async () => {
    setPaused.mockRejectedValueOnce(new Error('gone'));
    render(<WidgetPreview widgetId="input" />);
    await act(async () => undefined);
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not pause widget preview',
      expect.any(Error)
    );
  });

  it('holds the frame animations while the demo is not running, also after a reload', async () => {
    render(<WidgetPreview widgetId="input" />);
    const frame = screen.getByTitle('Input Traces demo') as HTMLIFrameElement;
    const posted = watchFrame(frame);
    const sequence = () =>
      posted('preview:init', 'preview:pause', 'preview:resume');
    // Nothing runs in the frame before it has a session.
    status({ running: false });
    expect(sequence()).toEqual([]);

    await act(async () => request(frame, { type: 'preview:ready' }));
    expect(sequence()).toEqual(['preview:init', 'preview:pause']);
    status({ running: true });
    // Another change that leaves the demo running is not passed on.
    status({ running: true, driving: true, playInCar: true });
    status({ running: false });
    expect(sequence()).toEqual([
      'preview:init',
      'preview:pause',
      'preview:resume',
      'preview:pause',
    ]);

    // A reloaded document starts running; it hears the current state.
    await act(async () => request(frame, { type: 'preview:ready' }));
    expect(sequence().slice(4)).toEqual(['preview:init', 'preview:pause']);
    status({ running: true });
    expect(sequence().slice(6)).toEqual(['preview:resume']);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('shows nothing for a demo held from the start, until Play runs it', async () => {
    // Moving to another widget page in the car: the new demo never runs.
    render(<WidgetPreview widgetId="laptrace" />);
    status({ driving: true, running: false });
    const frame = await connectedFrame('Lap Trace demo');
    fireEvent.load(frame);
    expect(frame).toHaveClass('invisible');
    expect(playButton()).toBeVisible();
    expect(screen.queryByText('Loading preview…')).toBeNull();
    expect(screen.queryByText(/paused/i)).toBeNull();

    fireEvent.click(playButton());
    expect(playInCar).toHaveBeenCalledOnce();
    status({ driving: true, playInCar: true, running: true });
    expect(frame).not.toHaveClass('invisible');
    expect(pauseButton()).toBeVisible();
  });

  it('shows the loading text only for a preview that will play, once main has said so', () => {
    const loading = () => screen.queryByText('Loading preview…');
    const { unmount } = render(<WidgetPreview widgetId="laptrace" />);
    // Before main's first status: it may be held, so nothing yet.
    expect(loading()).toBeNull();
    status({ driving: true, running: false });
    expect(loading()).toBeNull();
    status({ windowHidden: true, running: false });
    expect(loading()).toBeNull();
    status({ running: false });
    expect(loading()).not.toBeNull();
    fireEvent.click(pauseButton());
    expect(loading()).toBeNull();
    unmount();
  });

  it('keeps the picture of a demo that has run, when it is held later', async () => {
    render(<WidgetPreview widgetId="laptrace" />);
    const frame = await connectedFrame('Lap Trace demo');
    fireEvent.load(frame);
    expect(frame).not.toHaveClass('invisible');
    status({ driving: true, running: false });
    expect(frame).not.toHaveClass('invisible');
    expect(playButton()).toBeVisible();
  });

  it('hides a reloaded frame document again until its demo runs', async () => {
    render(<WidgetPreview widgetId="laptrace" />);
    const frame = await connectedFrame('Lap Trace demo');
    fireEvent.load(frame);
    status({ driving: true, running: false });
    await act(async () => request(frame, { type: 'preview:ready' }));
    expect(frame).toHaveClass('invisible');
    status({ driving: true, playInCar: true, running: true });
    expect(frame).not.toHaveClass('invisible');
  });

  it('plays in the car once main agrees, and pauses again the next time they get in', async () => {
    render(<WidgetPreview widgetId="input" />);
    const frame = await connectedFrame('Input Traces demo');
    status({ driving: true, running: false });
    expect(screen.getByTitle('Input Traces demo')).toBe(frame);
    expect(screen.queryByText(/paused/i)).toBeNull();

    fireEvent.click(playButton());
    expect(playInCar).toHaveBeenCalledOnce();
    expect(setPaused).toHaveBeenCalledOnce();
    // Main decides: until it reports, the preview stays paused.
    expect(playButton()).toBeVisible();
    status({ driving: true, playInCar: true, running: true });
    expect(pauseButton()).toBeVisible();

    // A pause and play while it runs in the car is the page's own.
    fireEvent.click(pauseButton());
    expect(setPaused).toHaveBeenLastCalledWith(true);
    fireEvent.click(playButton());
    expect(setPaused).toHaveBeenLastCalledWith(false);
    expect(playInCar).toHaveBeenCalledOnce();

    status({ driving: false, running: true });
    expect(pauseButton()).toBeVisible();
    status({ driving: true, running: false });
    expect(playButton()).toBeVisible();
    expect(disconnect).not.toHaveBeenCalled();
    expect(toggleDemo).not.toHaveBeenCalled();
  });

  it('keeps a manual pause after the player gets out of the car', async () => {
    render(<WidgetPreview widgetId="input" />);
    await connectedFrame('Input Traces demo');
    fireEvent.click(pauseButton());
    status({ driving: true, running: false });
    status({ driving: false, running: false });
    expect(playButton()).toBeVisible();
    expect(setPaused).toHaveBeenLastCalledWith(true);
    expect(playInCar).not.toHaveBeenCalled();
  });

  it('plays in the car after a manual pause with a single press', async () => {
    render(<WidgetPreview widgetId="input" />);
    await connectedFrame('Input Traces demo');
    fireEvent.click(pauseButton());
    status({ driving: true, running: false });
    fireEvent.click(playButton());
    expect(setPaused).toHaveBeenLastCalledWith(false);
    expect(playInCar).toHaveBeenCalledOnce();
  });

  it('shows Play while the settings window is minimised or in the tray, and Pause on restore', async () => {
    render(<WidgetPreview widgetId="input" />);
    await connectedFrame('Input Traces demo');
    status({ windowHidden: true, running: false });
    expect(playButton()).toBeVisible();
    status({ windowHidden: true, driving: true, running: false });
    expect(playButton()).toBeVisible();
    status({ running: true });
    expect(pauseButton()).toBeVisible();
    expect(setPaused).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
    // Only the preview: the overlays' Demo Mode is left as it was.
    expect(toggleDemo).not.toHaveBeenCalled();
  });

  it('reads inspector telemetry only while the demo is running', async () => {
    vi.useFakeTimers();
    getTelemetry.mockResolvedValue({} as Telemetry);
    render(<WidgetPreview widgetId="telemetryinspector" />);
    const frame = screen.getByTitle(
      'Telemetry Inspector demo'
    ) as HTMLIFrameElement;
    const posted = watchFrame(frame);
    await act(async () => request(frame, { type: 'preview:ready' }));
    expect(getTelemetry).toHaveBeenCalledOnce();
    expect(posted('preview:telemetry')).toHaveLength(1);
    status({ running: false });
    await act(async () => vi.advanceTimersByTime(3000));
    expect(getTelemetry).toHaveBeenCalledOnce();
    status({ running: true });
    await act(async () => vi.advanceTimersByTime(1000));
    expect(getTelemetry).toHaveBeenCalledTimes(2);
  });

  it('reads inspector telemetry for a first picture when it connects held', async () => {
    vi.useFakeTimers();
    getTelemetry.mockResolvedValueOnce(null).mockResolvedValue({} as Telemetry);
    render(<WidgetPreview widgetId="telemetryinspector" />);
    status({ driving: true, running: false });
    const frame = screen.getByTitle(
      'Telemetry Inspector demo'
    ) as HTMLIFrameElement;
    const posted = watchFrame(frame);
    await act(async () => request(frame, { type: 'preview:ready' }));
    // The demo had no frame yet: asked again until there is a picture.
    expect(getTelemetry).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(getTelemetry).toHaveBeenCalledTimes(2);
    expect(posted('preview:telemetry')).toHaveLength(1);
    // Then held, like the rest of the paused demo.
    await act(async () => vi.advanceTimersByTime(3000));
    expect(getTelemetry).toHaveBeenCalledTimes(2);
  });

  it('stops a timed-out attempt and ignores its late result after a successful retry', async () => {
    vi.useFakeTimers();
    let resolveSession!: (value: Session) => void;
    connect.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSession = resolve;
      })
    );
    const { unmount } = render(<WidgetPreview widgetId="input" />);
    const frame = screen.getByTitle('Input Traces demo') as HTMLIFrameElement;
    act(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'preview:ready' },
          source: frame.contentWindow,
        })
      )
    );
    expect(connect).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(15001));
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(disconnect).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const retry = screen.getByTitle('Input Traces demo') as HTMLIFrameElement;
    expect(retry).not.toBe(frame);
    expect(retry).toHaveClass('invisible');
    await act(async () =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'preview:ready' },
          source: retry.contentWindow,
        })
      )
    );
    fireEvent.load(retry);
    expect(connect).toHaveBeenCalledTimes(2);
    await act(async () => resolveSession(session));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(screen.getByTitle('Input Traces demo')).toBe(retry);
    expect(screen.queryByText('Loading preview…')).toBeNull();
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a stalled iframe reload and releases its previous subscriptions', async () => {
    vi.useFakeTimers();
    render(<WidgetPreview widgetId="input" />);
    const frame = screen.getByTitle('Input Traces demo') as HTMLIFrameElement;
    const request = (data: unknown) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data,
          source: frame.contentWindow,
        })
      );
    await act(async () => request({ type: 'preview:ready' }));
    act(() =>
      request({
        type: 'preview:subscribe',
        channel: 'driver-controls.snapshot',
      })
    );
    connect.mockReturnValueOnce(new Promise(() => undefined));
    act(() => request({ type: 'preview:ready' }));
    expect(stop).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(15001));
    expect(
      screen.getByText('The preview could not load. Try again.')
    ).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reconnects after the iframe reloads instead of leaving a blank preview', async () => {
    render(<WidgetPreview widgetId="input" />);
    const frame = screen.getByTitle('Input Traces demo') as HTMLIFrameElement;
    const request = (data: unknown) =>
      window.dispatchEvent(
        new MessageEvent('message', { data, source: frame.contentWindow })
      );
    await act(async () => {
      request({ type: 'preview:ready' });
    });
    act(() => {
      request({
        type: 'preview:subscribe',
        channel: 'driver-controls.snapshot',
        rate: 25,
      });
    });
    await act(async () => {
      request({ type: 'preview:ready' });
    });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('reconnects a reloaded frame while paused, keeping it paused', async () => {
    render(<WidgetPreview widgetId="input" />);
    const frame = await connectedFrame('Input Traces demo');
    fireEvent.click(pauseButton());
    status({ running: false });
    await act(async () => request(frame, { type: 'preview:ready' }));
    expect(connect).toHaveBeenCalledTimes(2);
    expect(screen.getByTitle('Input Traces demo')).toBe(frame);
    expect(playButton()).toBeVisible();
    expect(setPaused).toHaveBeenLastCalledWith(true);
  });
});
