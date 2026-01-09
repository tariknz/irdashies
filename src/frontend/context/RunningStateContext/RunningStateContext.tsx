import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { IrSdkBridge } from '@irdashies/types';

interface RunningStateContextProps {
  running: boolean;
}

interface RunningStateProviderProps {
  bridge: IrSdkBridge;
  children: ReactNode;
}

const RunningStateContext = createContext<RunningStateContextProps | undefined>(
  undefined
);

/**
 * Provides the running state of the iRacing SDK. This context is used to
 * conditionally render components based on whether iRacing is running.
 * This gets updates of the sim running state from the iRacing SDK bridge.
 *
 * @param bridge The iRacing SDK bridge
 * @param children The children to render
 * @returns The running state context provider
 */
export const RunningStateProvider = ({
  bridge,
  children,
}: RunningStateProviderProps) => {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    console.log('🏃 RunningStateProvider mounted');
    bridge.onRunningState((isRunning) => setRunning(isRunning));
    return () => bridge.stop();
  }, [bridge]);

  return (
    <RunningStateContext.Provider value={{ running }}>
      {children}
    </RunningStateContext.Provider>
  );
};

export const useRunningState = (): RunningStateContextProps => {
  const context = useContext(RunningStateContext);
  if (!context) {
    throw new Error(
      'useRunningState must be used within a RunningStateProvider'
    );
  }
  return context;
};
