import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RunningStateProvider, useRunningState } from './RunningStateContext';
import type { IrSdkBridge } from '@irdashies/types';
import { ReactNode } from 'react';

describe('RunningStateContext', () => {
  const mockBridge: IrSdkBridge = {
    onRunningState: vi.fn(),
    onSessionData: vi.fn(),
    onTelemetry: vi.fn(),
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
      }
    );

    renderWithProvider(mockBridge, <TestComponent />);
    expect(screen.getByText('Not Running')).toBeInTheDocument();

    act(() => runningStateCallback(true));
    expect(screen.getByText('Running')).toBeInTheDocument();

    act(() => runningStateCallback(false));
    expect(screen.getByText('Not Running')).toBeInTheDocument();
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
