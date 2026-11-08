import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDashboard, type Session } from '@irdashies/types';
import { WidgetPreview } from './WidgetPreview';

const save = vi.fn();
const toggleDemo = vi.fn();
vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: defaultDashboard,
    onDashboardUpdated: save,
    toggleDemoMode: toggleDemo,
  }),
  useElementSize: () => ({ width: 800, height: 240 }),
}));
const connect = vi.fn(
  async () => ({ DriverInfo: { Drivers: [] } }) as unknown as Session
);
const disconnect = vi.fn(async () => undefined);
const stop = vi.fn();
const subscribe = vi.fn(() => stop);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  window.widgetPreviewBridge = {
    connect,
    disconnect,
    subscribe,
    getTelemetry: async () => null,
  };
});
afterEach(() => {
  delete window.widgetPreviewBridge;
  vi.unstubAllGlobals();
});

describe('settings widget preview', () => {
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
