import { act, fireEvent, render, screen } from '@testing-library/react';
import { startTransition, Suspense, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultDashboard,
  type DashboardLayout,
  type Session,
  type WidgetPreviewHold,
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
/** Pushes a hold the way main does; set while a preview is listening. */
let sendHold: ((hold: WidgetPreviewHold) => void) | undefined;
const onHold = vi.fn((callback: (hold: WidgetPreviewHold) => void) => {
  sendHold = callback;
  return () => {
    sendHold = undefined;
  };
});
const hold = (value: Partial<WidgetPreviewHold>) =>
  act(() => sendHold?.({ windowHidden: false, driving: false, ...value }));

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
    onHold,
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
    expect(screen.getByText('Preview paused.')).toBeInTheDocument();
    expect(screen.queryByTitle('Input Traces demo')).not.toBeInTheDocument();
    expect(disconnect).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Play preview' }));
    expect(screen.getByTitle('Input Traces demo')).toBeInTheDocument();
  });

  it('pauses while the settings window is minimised or in the tray, and comes back with a fresh frame', () => {
    const { unmount } = render(<WidgetPreview widgetId="input" />);
    const original = screen.getByTitle('Input Traces demo');
    hold({ windowHidden: true });
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(screen.getByText('Preview paused.')).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalledOnce();
    hold({ windowHidden: false });
    const resumed = screen.getByTitle('Input Traces demo');
    expect(resumed).not.toBe(original);
    expect(screen.getByRole('button', { name: 'Pause preview' })).toBeVisible();
    // Only the preview: the overlays' Demo Mode is left as it was.
    expect(toggleDemo).not.toHaveBeenCalled();
    unmount();
    expect(sendHold).toBeUndefined();
  });

  it('pauses while the player is in the car, says why, and keeps a manual pause after they get out', () => {
    render(<WidgetPreview widgetId="input" />);
    hold({ driving: true });
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    expect(
      screen.getByText('Preview paused while you are in the car.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pause preview' }));
    expect(screen.getByText('Preview paused.')).toBeInTheDocument();
    hold({ driving: false });
    expect(screen.queryByTitle('Input Traces demo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play preview' }));
    expect(screen.getByTitle('Input Traces demo')).toBeInTheDocument();
    expect(toggleDemo).not.toHaveBeenCalled();
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
});
