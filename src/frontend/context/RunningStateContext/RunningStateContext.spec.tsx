import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RunningStateProvider, useRunningState } from './RunningStateContext';
import type { IrSdkBridge } from '@irdashies/types';
import { ReactNode } from 'react';

describe('RunningStateContext', () => {
  const mockBridge: IrSdkBridge = {
    onRunningState: vi.fn(),
    onSessionData: vi.fn(),
    stop: vi.fn(),
  };

  const TestComponent: React.FC = () => {
    const { running } = useRunningState();
    return <div>{running ? 'Running' : 'Not Running'}</div>;
  };

  const renderWithProvider = (bridge: IrSdkBridge, children: ReactNode) => {
    return render(
      <RunningStateProvider bridge={bridge}>{children}</RunningStateProvider>
    );
  };

  it('should provide the initial running state as false', () => {
    renderWithProvider(mockBridge, <TestComponent />);
    expect(screen.getByText('Not Running')).toBeInTheDocument();
  });

  it('should update the running state when bridge.onRunningState is called', () => {
    let runningStateCallback: (isRunning: boolean) => void = () => {
      /** noop */
    };

    vi.spyOn(mockBridge, 'onRunningState').mockImplementation(
      (callback: (isRunning: boolean) => void) => {
        runningStateCallback = callback;
        return undefined;
      }
    );

    renderWithProvider(mockBridge, <TestComponent />);
    expect(screen.getByText('Not Running')).toBeInTheDocument();

    act(() => runningStateCallback(true));
    expect(screen.getByText('Running')).toBeInTheDocument();

    act(() => runningStateCallback(false));
    expect(screen.getByText('Not Running')).toBeInTheDocument();
  });

  it('seeds itself from the bridge when it subscribes mid-session', async () => {
    // onRunningState only reports changes, so a settings window opened while
    // the sim was already running would sit on `false` until it next stopped.
    // The main process cannot push the value instead: the page's load event
    // precedes this subscription, and nothing buffers an earlier message.
    const bridge: IrSdkBridge = {
      onRunningState: vi.fn(),
      onSessionData: vi.fn(),
      getRunningState: vi.fn().mockResolvedValue(true),
      stop: vi.fn(),
    };

    renderWithProvider(bridge, <TestComponent />);

    expect(await screen.findByText('Running')).toBeInTheDocument();
  });

  it('lets a change that lands first outrank the seeded snapshot', async () => {
    // The snapshot describes the moment it was asked for. A sim stopping while
    // the request is in flight must not be undone by the older answer.
    let runningStateCallback: (isRunning: boolean) => void = () => {
      /** noop */
    };
    let resolveSnapshot: ((value: boolean) => void) | undefined;
    const bridge: IrSdkBridge = {
      onRunningState: vi.fn((callback: (isRunning: boolean) => void) => {
        runningStateCallback = callback;
        return undefined;
      }),
      onSessionData: vi.fn(),
      getRunningState: vi.fn(
        () => new Promise<boolean>((resolve) => (resolveSnapshot = resolve))
      ),
      stop: vi.fn(),
    };

    renderWithProvider(bridge, <TestComponent />);

    // The sim stops before the snapshot -- taken while it was still up -- lands.
    act(() => runningStateCallback(true));
    act(() => runningStateCallback(false));
    await act(async () => {
      resolveSnapshot?.(true);
    });

    expect(screen.getByText('Not Running')).toBeInTheDocument();
  });

  it('waits for the next change when the bridge cannot be asked', async () => {
    // Not every transport answers; one that does not must behave as before
    // rather than throwing on the optional call.
    let runningStateCallback: (isRunning: boolean) => void = () => {
      /** noop */
    };
    const bridge: IrSdkBridge = {
      onRunningState: vi.fn((callback: (isRunning: boolean) => void) => {
        runningStateCallback = callback;
        return undefined;
      }),
      onSessionData: vi.fn(),
      stop: vi.fn(),
    };

    renderWithProvider(bridge, <TestComponent />);
    expect(screen.getByText('Not Running')).toBeInTheDocument();

    act(() => runningStateCallback(true));
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('should throw an error if useRunningState is used outside of RunningStateProvider', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {
        /** noop */
      });

    expect(() => render(<TestComponent />)).toThrow(
      'useRunningState must be used within a RunningStateProvider'
    );
    consoleErrorSpy.mockRestore();
  });
});
