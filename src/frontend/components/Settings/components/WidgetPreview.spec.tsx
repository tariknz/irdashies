import { act, fireEvent, render, screen } from '@testing-library/react';
import { startTransition, Suspense, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultDashboard,
  type DashboardLayout,
  type Session,
  type WidgetPreviewStatus,
} from '@irdashies/types';
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
const session = { DriverInfo: { Drivers: [] } } as unknown as Session;
const connect = vi.fn(async () => session);
const disconnect = vi.fn(async () => undefined);
const stop = vi.fn();
const subscribe = vi.fn(() => stop);
/** What main would report; answered at once on subscribe, as main does. */
let mainStatus: WidgetPreviewStatus = { windowHidden: false, driving: false };
/** Leaves the subscription unanswered, as before main's reply arrives. */
let answerOnSubscribe = true;
const listeners = new Set<(status: WidgetPreviewStatus) => void>();
const onStatus = vi.fn((callback: (status: WidgetPreviewStatus) => void) => {
  listeners.add(callback);
  if (answerOnSubscribe) callback(mainStatus);
  return () => {
    listeners.delete(callback);
  };
});
/** Pushes a status change the way main does. */
const status = (value: Partial<WidgetPreviewStatus>) => {
  mainStatus = { windowHidden: false, driving: false, ...value };
  act(() => listeners.forEach((listener) => listener(mainStatus)));
};
const playButton = () => screen.getByRole('button', { name: 'Play preview' });
const pauseButton = () => screen.getByRole('button', { name: 'Pause preview' });

beforeEach(() => {
  vi.clearAllMocks();
  connect.mockResolvedValue(session);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  );
  window.widgetPreviewBridge = {
    connect,
    disconnect,
    subscribe,
    getTelemetry: async () => null,
    onStatus,
  };
});
afterEach(() => {
  dashboard = undefined;
  mainStatus = { windowHidden: false, driving: false };
  answerOnSubscribe = true;
  listeners.clear();
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

  it('keeps the initial iframe paint hidden until its document styles have loaded', () => {
    render(<WidgetPreview widgetId="input" />);
    const frame = screen.getByTitle('Input Traces demo');
    expect(frame).toHaveClass('invisible');
    fireEvent.load(frame);
    expect(frame).not.toHaveClass('invisible');
    fireEvent.click(screen.getByRole('button', { name: 'Pause preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play preview' }));
    expect(screen.getByTitle('Input Traces demo')).toHaveClass('invisible');
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
      request({ type: 'preview:subscribe', channel: '__proto__' });
    });
    expect(subscribe).toHaveBeenCalledOnce();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('stops the demo when paused and recreates its isolated frame on resume', () => {
    render(<WidgetPreview widgetId="input" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause preview' }));
    expect(screen.getByText('Preview paused')).toBeInTheDocument();
    expect(screen.queryByTitle('Input Traces demo')).not.toBeInTheDocument();
    expect(disconnect).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Play preview' }));
    expect(screen.getByTitle('Input Traces demo')).toBeInTheDocument();
  });

  it('hides each replacement iframe until its own load event after visibility resumes', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    render(<WidgetPreview widgetId="input" />);
    const original = screen.getByTitle('Input Traces demo');
    fireEvent.load(original);
    expect(original).not.toHaveClass('invisible');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(disconnect).toHaveBeenCalledOnce();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    const resumed = screen.getByTitle('Input Traces demo');
    expect(resumed).not.toBe(original);
    expect(resumed).toHaveClass('invisible');
    fireEvent.load(resumed);
    expect(resumed).not.toHaveClass('invisible');
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

  it('stops while the settings window is minimised or in the tray, and starts a new demo on restore', () => {
    render(<WidgetPreview widgetId="input" />);
    const original = screen.getByTitle('Input Traces demo');
    status({ windowHidden: true });
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(screen.getByText('Preview paused')).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalledOnce();
    status({ windowHidden: false });
    expect(screen.getByTitle('Input Traces demo')).not.toBe(original);
    expect(screen.queryByText('Preview paused')).toBeNull();
    // Only the preview: the overlays' Demo Mode is left as it was.
    expect(toggleDemo).not.toHaveBeenCalled();
  });

  it('stops when the player gets in the car, plays on request there, and stops again the next time in', () => {
    render(<WidgetPreview widgetId="input" />);
    status({ driving: true });
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(screen.getByText('Preview paused')).toBeInTheDocument();
    fireEvent.click(playButton());
    expect(screen.getByTitle('Input Traces demo')).toBeInTheDocument();
    expect(pauseButton()).toBeVisible();
    // Repeated reports of the same state leave it playing.
    status({ driving: true });
    expect(screen.getByTitle('Input Traces demo')).toBeInTheDocument();
    status({ driving: false });
    expect(screen.getByTitle('Input Traces demo')).toBeInTheDocument();
    status({ driving: true });
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(playButton()).toBeVisible();
  });

  it('arrives stopped on another widget page while the player is in the car', () => {
    const { rerender } = render(
      <WidgetPreview key="laptrace" widgetId="laptrace" />
    );
    status({ driving: true });
    fireEvent.click(playButton());
    expect(screen.getByTitle('Lap Trace demo')).toBeInTheDocument();
    // Each widget page mounts its own preview, as the settings pages do.
    rerender(<WidgetPreview key="input" widgetId="input" />);
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(playButton()).toBeVisible();
    expect(screen.getByText('Preview paused')).toBeInTheDocument();
  });

  it('keeps a manual pause after the player gets out of the car', () => {
    render(<WidgetPreview widgetId="input" />);
    fireEvent.click(pauseButton());
    status({ driving: true });
    status({ driving: false });
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(playButton()).toBeVisible();
  });

  it("waits for main's status before starting a demo, without flashing the loading text or the label", () => {
    answerOnSubscribe = false;
    render(<WidgetPreview widgetId="input" />);
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(screen.queryByText('Loading preview…')).toBeNull();
    expect(screen.queryByText('Preview paused')).toBeNull();
    status({ driving: true });
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(screen.getByText('Preview paused')).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
  });

  it('does not say paused for an error or without the desktop app', () => {
    delete window.widgetPreviewBridge;
    render(<WidgetPreview widgetId="input" />);
    expect(
      screen.getByText('Preview is available in the desktop app.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Preview paused')).toBeNull();
  });
});
